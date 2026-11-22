import {
    ColorSpace,
    type IFramework,
    type ISampler,
    MipMapSamplerFilter,
    GpuBackend,
    SamplerDescriptor,
    SamplerFilter
} from "ris-framework";
import {create} from "zustand";
import {loadDisplayColorSpace, saveDisplayColorSpace} from "../service/displayColorSpaceStorage.ts";
import {View2D} from "../model/View.ts";
import {
    backendName,
    loadBackend,
    probeWebGpuAsync,
    saveBackend,
    type ViewerBackend,
    type WebGpuAvailability
} from "../service/backendStorage.ts";

/** One-off viewer message (snackbar), e.g. the WebGPU → WebGL2 fallback. */
export interface ViewerNotice {
    id: number;
    severity: "info" | "warning" | "error";
    message: string;
}

let nextNoticeId = 0;

/**
 * Framework instance and viewer display settings (view mode, sampler filter).
 * GPU capabilities are read from `framework.graphicsDevice.features`.
 *
 * The framework is set by useFramework; other stores/services read it via
 * `useViewerStore.getState().framework`.
 */
interface ViewerStore {
    framework: IFramework | null;
    /** Set when the GPU framework could not be created (e.g. no WebGL2). */
    initError: string | null;

    /**
     * Rendering backend the viewport creates its framework with (header WebGL2 | WebGPU switch). Changing it
     * remounts the canvas: useFramework disposes the current framework, creates one with the new backend and
     * re-uploads every texture (TextureStore.moveTexturesToFramework). Persisted in localStorage
     * (`ris-ktx2-viewer.backend`), WebGL2 by default.
     */
    backend: ViewerBackend;
    /** WebGPU support in this browser (navigator.gpu and an adapter); the switch disables WebGPU otherwise. */
    webGpu: WebGpuAvailability;
    notice: ViewerNotice | null;

    view: string;
    filter: SamplerFilter;
    sampler: ISampler | undefined;

    /**
     * The Inspector's Display switch (sRGB | Linear, default sRGB). Only sets the renderer output for all textures:
     * sRGB → renderer.outputColorSpace SRGB, Linear → NONE, plus the clear color (service/outputColorSpace.ts). Texture
     * formats are per texture (ITexture2DContainer.textureColorSpace). Persisted in localStorage
     * (`ris-ktx2-viewer.displayColorSpace`; the old "FILE" value loads as sRGB) and restored at module load,
     * before the first texture upload.
     */
    displayColorSpace: ColorSpace;


    setFramework: (framework: IFramework) => void;
    /** Switches the backend (no-op when unchanged) and saves it. */
    setBackend: (backend: ViewerBackend) => void;
    /** Stores and persists the display color space. Callers recreate existing textures (TextureStore.applyDisplayColorSpace). */
    setDisplayColorSpace: (colorSpace: ColorSpace) => void;
    /**
     * WebGPU failed to start: ris-framework 0.4 doesn't fall back, so the viewer does. Switches to WebGL2,
     * saves it, and shows the error.
     */
    fallbackToWebGl: (error: unknown) => void;
    /** Probes WebGPU once (called at start). */
    probeWebGpuAsync: () => Promise<void>;
    showNotice: (severity: ViewerNotice["severity"], message: string) => void;
    dismissNotice: () => void;
    /** Disposes the sampler and forgets the framework (viewport unmounted). */
    clearFramework: () => void;
    setInitError: (message: string) => void;
    setView: (view: string) => void;
    setFilter: (filter: SamplerFilter) => void;
}


function createSampler(
    framework: IFramework,
    filter: SamplerFilter,
    previous?: ISampler,
): ISampler {
    previous?.queueDispose();

    const descriptor = new SamplerDescriptor();
    descriptor.minFilter = filter;
    descriptor.magFilter = filter;
    descriptor.mipMapFilter = filter == SamplerFilter.LINEAR ? MipMapSamplerFilter.LINEAR : MipMapSamplerFilter.NEAREST;
    return framework.graphicsDevice.createSampler(descriptor);
}

export const useViewerStore = create<ViewerStore>((set, get) => ({
    framework: null,
    initError: null,
    backend: loadBackend(),
    webGpu: {status: "checking"},
    notice: null,

    view: View2D,
    filter: SamplerFilter.LINEAR,
    sampler: undefined,

    setFramework: (framework) => {
        const {filter, sampler} = get();
        set({
            framework,
            initError: null,
            sampler: createSampler(framework, filter, sampler),
        });
    },

    clearFramework: () => {
        get().sampler?.dispose();
        set({framework: null, sampler: undefined});
    },

    setInitError: (initError) => set({initError}),

    displayColorSpace: loadDisplayColorSpace(),
    setDisplayColorSpace: (displayColorSpace) => {
        saveDisplayColorSpace(displayColorSpace);
        set({displayColorSpace});
    },
    setBackend: (backend) => {
        saveBackend(backend);
        if (get().backend !== backend) {
            set({backend, initError: null});
        }
    },

    fallbackToWebGl: (error) => {
        const message = error instanceof Error ? error.message : String(error);
        saveBackend(GpuBackend.WEB_GL);
        set({
            backend: GpuBackend.WEB_GL,
            notice: {
                id: ++nextNoticeId,
                severity: "warning",
                message: `${backendName(GpuBackend.WEB_GPU)} could not start, switched to ${backendName(GpuBackend.WEB_GL)}: ${message}`,
            },
        });
    },

    probeWebGpuAsync: async () => {
        set({webGpu: await probeWebGpuAsync()});
    },

    showNotice: (severity, message) => set({notice: {id: ++nextNoticeId, severity, message}}),

    dismissNotice: () => set({notice: null}),


    setView: (view) => set({view}),

    setFilter: (filter) => {
        const {framework, sampler} = get();
        if (!framework) {
            return;
        }

        set({
            filter,
            sampler: createSampler(framework, filter, sampler),
        });
    },
}));

/**
 * The current framework, or the next one once it is set (e.g. while the backend is being switched).
 * Rejects when the signal aborts, or when initialization has failed (`initError`) and no framework is coming.
 */
export function waitForFrameworkAsync(signal?: AbortSignal): Promise<IFramework> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(signal.reason ?? new DOMException("Aborted", "AbortError"));
            return;
        }

        let settled = false;
        const finish = (action: () => void) => {
            if (settled) {
                return;
            }
            settled = true;
            unsubscribe();
            signal?.removeEventListener("abort", onAbort);
            action();
        };
        const onAbort = () => {
            finish(() => reject(signal?.reason ?? new DOMException("Aborted", "AbortError")));
        };

        // Subscribe first, then re-read: a framework set between a getState() and subscribe would otherwise be missed.
        const unsubscribe = useViewerStore.subscribe((state) => {
            if (state.framework) {
                finish(() => resolve(state.framework as IFramework));
            } else if (state.initError) {
                finish(() => reject(new Error(state.initError as string)));
            }
        });
        signal?.addEventListener("abort", onAbort, {once: true});

        const {framework, initError} = useViewerStore.getState();
        if (framework) {
            finish(() => resolve(framework));
        } else if (initError) {
            finish(() => reject(new Error(initError)));
        }
    });
}

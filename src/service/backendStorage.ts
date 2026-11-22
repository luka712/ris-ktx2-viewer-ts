import {GpuBackend} from "ris-framework";

/** localStorage key for the rendering backend switch (WebGL2 | WebGPU). */
export const BACKEND_STORAGE_KEY = "ris-ktx2-viewer.backend";

/** The backends the viewer offers. WebGL2 is the default. */
export type ViewerBackend = GpuBackend.WEB_GL | GpuBackend.WEB_GPU;

export const DEFAULT_BACKEND: ViewerBackend = GpuBackend.WEB_GL;

const STORED: Record<string, ViewerBackend> = {webgl2: GpuBackend.WEB_GL, webgpu: GpuBackend.WEB_GPU};

/** Stored value of a backend ("webgl2" / "webgpu"; the enum is numeric and may be renumbered). */
export function backendStorageValue(backend: ViewerBackend): string {
    return backend === GpuBackend.WEB_GPU ? "webgpu" : "webgl2";
}

/** Saved backend; WebGL2 when nothing is saved, the value is invalid or storage is unavailable. */
export function loadBackend(): ViewerBackend {
    try {
        const saved = localStorage.getItem(BACKEND_STORAGE_KEY);
        return (saved !== null ? STORED[saved] : undefined) ?? DEFAULT_BACKEND;
    } catch {
        return DEFAULT_BACKEND;
    }
}

/** Saves the backend; ignores unavailable storage. */
export function saveBackend(backend: ViewerBackend) {
    try {
        localStorage.setItem(BACKEND_STORAGE_KEY, backendStorageValue(backend));
    } catch {
        // Not persisted; the switch still works for this session.
    }
}

/** Label used in the header switch, status bar and GPU info. */
export function backendName(backend: GpuBackend): string {
    return backend === GpuBackend.WEB_GPU ? "WebGPU" : backend === GpuBackend.WEB_GL ? "WebGL2" : "Default";
}

/** WebGPU availability in this browser, probed once at start. */
export type WebGpuAvailability =
    | { status: "checking" }
    | { status: "available" }
    | { status: "unavailable"; reason: string };

/** Checks `navigator.gpu` and requests an adapter (a missing adapter means WebGPU can't start). */
export async function probeWebGpuAsync(gpu: GPU | undefined = (globalThis.navigator as Navigator | undefined)?.gpu): Promise<WebGpuAvailability> {
    if (!gpu) {
        return {status: "unavailable", reason: "This browser has no WebGPU (navigator.gpu is missing)."};
    }
    try {
        const adapter = await gpu.requestAdapter();
        return adapter
            ? {status: "available"}
            : {status: "unavailable", reason: "WebGPU is present, but no GPU adapter is available."};
    } catch (err) {
        return {status: "unavailable", reason: `Requesting a WebGPU adapter failed: ${err instanceof Error ? err.message : String(err)}`};
    }
}

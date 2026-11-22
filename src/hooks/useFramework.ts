import {useEffect, useRef} from "react";
import {
    CullMode,
    Framework,
    type GameTime,
    type IFramework,
    type IGraphicsDevice,
    type InspectTextureArrayMaterial,
    type InspectTextureMipsMaterial,
    type OrbitCamera,
    PowerPreferenceType,
    GpuBackend,
    Scene,
    TextureSamplerFilteringPreset,
    type UnlitMaterial,
    type UnlitTextureArrayMaterial
} from "ris-framework";
import type {IKtx2FactoryInitializeParams} from "ris-ktx2";
import {vec2, vec3} from "gl-matrix";
import {View2D, View3D} from "../model/View.ts";
import {isTextureArray} from "../model/ITexture2DContainer.ts";
import {selectSelectedTexture, useTextureStore} from "../store/TextureStore.ts";
import {useViewerStore} from "../store/viewerStore.ts";
import type {ViewerBackend} from "../service/backendStorage.ts";
import {applyOutputColorSpace, outputColorSpaceFor} from "../service/outputColorSpace.ts";


/**
 * GPU objects created once the framework is initialized.
 * The 3D view is a framework Scene holding the unlit quad and the orbit camera: the scene assigns its camera
 * to the quad's material and renders it. The 2D mip inspection is a second, camera-less Scene with the
 * InspectTextureMipsMaterial quad (it draws in clip space, so it needs no camera); keeping it in a scene too
 * gives both views the same render and dispose path. Texture arrays use their own 2D scene
 * (InspectTextureArrayMaterial, clip space) and 3D scene (UnlitTextureArrayMaterial with the same camera), so a
 * layer switch only changes the material's layer.
 */
interface ViewScenes {
    camera: OrbitCamera;
    scene2D: Scene;
    scene2DArray: Scene;
    scene3D: Scene;
    scene3DArray: Scene;
    mipMaterial: InspectTextureMipsMaterial;
    arrayMaterial: InspectTextureArrayMaterial;
    unlitMaterial: UnlitMaterial;
    unlitArrayMaterial: UnlitTextureArrayMaterial;
}

const INITIAL_CANVAS_WIDTH = 1920;
const INITIAL_CANVAS_HEIGHT = 1080;

function createViewScenes(fw: IFramework): ViewScenes {
    const camera = fw.cameraFactory.createOrbitCamera();
    camera.setEye(vec3.fromValues(0, 0, 2));
    camera.sensitivity = 0.5;
    camera.scrollSpeed = 5;

    const geometry = fw.geometryBuilder.quadGeometry(vec2.fromValues(2, 2));

    const mipMaterial = fw.materialFactory.createInspectTextureMipsMaterial();
    const scene2D = new Scene(fw);
    scene2D.add(fw.meshFactory.create(geometry, mipMaterial));

    const arrayMaterial = fw.materialFactory.createInspectTextureArrayMaterial();
    // Sample the selected mip level with textureLod, like the mip material.
    arrayMaterial.inspectLod = true;
    const scene2DArray = new Scene(fw);
    scene2DArray.add(fw.meshFactory.create(geometry, arrayMaterial));

    // Double-sided so the quad stays visible when orbiting behind it.
    const doubleSided = () => fw.graphicsDevice.createPrimitiveState({cullFace: CullMode.NONE});
    const unlitMaterial = fw.materialFactory.createUnlitMaterial({primitiveState: doubleSided()});
    const scene3D = new Scene(fw);
    scene3D.add(fw.meshFactory.create(geometry, unlitMaterial));
    // Becomes the scene camera; the scene assigns it to the quad's material.
    scene3D.add(camera);

    const unlitArrayMaterial = fw.materialFactory.createUnlitTextureArrayMaterial({primitiveState: doubleSided()});
    const scene3DArray = new Scene(fw);
    scene3DArray.add(fw.meshFactory.create(geometry, unlitArrayMaterial));
    // Same orbit camera, so switching between a texture and an array keeps the view.
    scene3DArray.add(camera);

    return {camera, scene2D, scene2DArray, scene3D, scene3DArray, mipMaterial, arrayMaterial, unlitMaterial, unlitArrayMaterial};
}

/** Scenes dispose their meshes and materials; the camera is not owned by the scene. */
function disposeViewScenes(scenes: ViewScenes) {
    scenes.scene2D.dispose();
    scenes.scene2DArray.dispose();
    scenes.scene3D.dispose();
    scenes.scene3DArray.dispose();
    scenes.camera.dispose();
}

/**
 * ris-ktx2 init params for the framework's device: its WebGL2 context or GPUDevice (used by ris-ktx2's own
 * glUpload / gpuUpload; the framework uploads itself, but the factory should point at the live device).
 */
function ktx2InitializeParams(device: IGraphicsDevice): IKtx2FactoryInitializeParams {
    if (device.api === GpuBackend.WEB_GL && "gl" in device) {
        return {preinitializedWebGLContext: device.gl as WebGL2RenderingContext, preinitializedGPUDevice: null};
    }
    if (device.api === GpuBackend.WEB_GPU && "device" in device) {
        return {preinitializedWebGLContext: null, preinitializedGPUDevice: device.device as GPUDevice};
    }
    return {};
}

function throwIfAborted(signal: AbortSignal) {
    if (signal.aborted) {
        throw signal.reason ?? new DOMException("Aborted", "AbortError");
    }
}

/**
 * Creates and initializes a framework on the canvas with the given backend. Rejects if the backend can't start
 * (ris-framework 0.4 has no WebGPU → WebGL fallback; the caller does that).
 * Each mount gets its own framework and disposes it on unmount (Framework.dispose() stops the render loop
 * and input). A canvas keeps the context type it got first, so the viewport uses a new canvas per backend.
 * Stops after each await if `signal` is aborted, so a remount does not re-point the shared libktx module.
 */
async function createFrameworkAsync(
    canvas: HTMLCanvasElement,
    backend: ViewerBackend,
    register: (fw: IFramework) => void,
    signal: AbortSignal,
): Promise<IFramework> {
    canvas.width = INITIAL_CANVAS_WIDTH;
    canvas.height = INITIAL_CANVAS_HEIGHT;
    const fw: IFramework = new Framework({
        canvas,
        gpuBackend: backend,
        alpha: true,
        powerPreference: PowerPreferenceType.HIGH_PERFORMANCE,
        useKtx2: true,
        backBufferSize: vec2.fromValues(INITIAL_CANVAS_WIDTH, INITIAL_CANVAS_HEIGHT),
        textureFiltering: TextureSamplerFilteringPreset.TRILINEAR,
        // Follows the Display switch (saved value): sRGB → SRGB output (encode on present, blit shader on WebGL2 and
        // WebGPU), Linear → NONE (pass-through). Set again after init together with the clear color, and live on
        // switch (TextureStore.applyDisplayColorSpace). Texture formats are per texture. See service/outputColorSpace.ts.
        outputColorSpace: outputColorSpaceFor(useViewerStore.getState().displayColorSpace),
    });
    // Disposed by the caller if the viewport unmounts while this is still initializing.
    register(fw);
    // Creates the WebGL2 context / WebGPU device (rejects if unsupported) and starts the render loop.
    await fw.initializeAsync();
    // Stop before touching the realm-wide libktx module or the disposed device (StrictMode remount, backend
    // switch, layout remount). Cleanup has already aborted the signal and disposed `fw`.
    throwIfAborted(signal);
    // initializeAsync starts loading libktx without the device and doesn't wait for it; KTX2 loads need it ready.
    // libktx is shared per realm, so this also re-points it at the new device after a backend switch.
    await fw.ktx2Factory?.initializeAsync(ktx2InitializeParams(fw.graphicsDevice));
    throwIfAborted(signal);
    // Output color space and a clear color that shows the same gray in both modes. Read again here: the switch may
    // have changed while this framework was initializing.
    applyOutputColorSpace(fw, useViewerStore.getState().displayColorSpace);
    return fw;
}

/** Framework of the last mounted viewport, to detect a canvas / backend change. */
let lastFramework: IFramework | null = null;

/** Adds the update/render listeners and publishes the framework. Returns the teardown (not fw.dispose()). */
function startViewer(fw: IFramework, scenes: ViewScenes, canvas: HTMLCanvasElement): () => void {
    const {camera, scene2D, scene2DArray, scene3D, scene3DArray, mipMaterial, arrayMaterial, unlitMaterial, unlitArrayMaterial} = scenes;
    const previousSize = {width: 0, height: 0};

    const onUpdate = (gt: GameTime) => {
        // Orbit input (the scene does not drive camera controllers), then scene transforms and camera binding.
        camera.update(gt);
        scene3D.update(gt);
        scene3DArray.update(gt);
        scene2D.update(gt);
        scene2DArray.update(gt);

        const tex = selectSelectedTexture(useTextureStore.getState())?.texture;

        // If previous size is same to texture size, return as there is nothing to do.
        const width = tex?.size[0] ?? 0;
        const height = tex?.size[1] ?? 0;
        if (!tex || (previousSize.width === width && previousSize.height === height)) {
            return;
        }

        // Fit the canvas, back buffer and quad to the texture when its size changes.
        // Runs in the update phase, before the frame's render pass starts.
        previousSize.width = width;
        previousSize.height = height;
        canvas.width = width;
        canvas.height = height;
        fw.renderer.backBufferSize = vec2.fromValues(width, height);
    };

    const onRender = () => {
        const tex = selectSelectedTexture(useTextureStore.getState())?.texture;
        if (!tex) {
            return;
        }
        const {sampler, view} = useViewerStore.getState();
        const {mipLevel, layer} = useTextureStore.getState();

        if (view === View2D) {
            if (isTextureArray(tex)) {
                arrayMaterial.texture = tex;
                arrayMaterial.textureSampler = sampler;
                arrayMaterial.layer = layer;
                arrayMaterial.mipLevel = mipLevel;
                scene2DArray.render();
            } else {
                mipMaterial.texture = tex;
                mipMaterial.textureSampler = sampler;
                mipMaterial.mipLevel = mipLevel;
                scene2D.render();
            }
        } else if (view === View3D) {
            if (isTextureArray(tex)) {
                unlitArrayMaterial.diffuseTexture = tex;
                unlitArrayMaterial.diffuseTextureSampler = sampler;
                unlitArrayMaterial.layer = layer;
                scene3DArray.render();
            } else {
                unlitMaterial.diffuseTexture = tex;
                unlitMaterial.diffuseTextureSampler = sampler;
                scene3D.render();
            }
        }
    };

    fw.addOnUpdateListener(onUpdate);
    fw.addOnRenderListener(onRender);
    // A remounted viewport (layout switch at the md breakpoint, or a backend switch) has a new canvas and
    // context/device: re-upload every texture there, keeping selection, mip, layer, view and color space.
    if (lastFramework && lastFramework !== fw) {
        useTextureStore.getState().moveTexturesToFramework(fw);
    }
    lastFramework = fw;
    useViewerStore.getState().setFramework(fw);

    return () => {
        fw.removeOnUpdateListener(onUpdate);
        fw.removeOnRenderListener(onRender);
        disposeViewScenes(scenes);
        useViewerStore.getState().clearFramework();
    };
}

/**
 * Creates the framework on the returned canvas ref with the store's backend, publishes it to ViewerStore,
 * and renders the selected texture every frame (2D mip inspection or 3D orbit view).
 * The canvas / back buffer follows the selected texture's size. Every mount creates its own canvas inside the
 * returned host element: dispose() loses the WebGL context, and a canvas keeps its first (lost) context, so a
 * remount (React StrictMode, layout switch, backend switch) must never reuse the previous canvas.
 * If WebGPU can't start, the viewer falls back to WebGL2 (ViewerStore.fallbackToWebGl); if WebGL2 can't start,
 * the error is published as `ViewerStore.initError`.
 */
export function useFramework(backend: ViewerBackend) {
    const hostRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const host = hostRef.current;
        if (!host) {
            return;
        }
        const canvas = document.createElement("canvas");
        canvas.setAttribute("aria-label", "Texture preview");
        Object.assign(canvas.style, {maxWidth: "100%", maxHeight: "100%", objectFit: "contain", color: "transparent"});
        host.appendChild(canvas);

        let unmounted = false;
        let fw: IFramework | null = null;
        let stopViewer: (() => void) | null = null;
        const controller = new AbortController();

        void (async () => {
            try {
                const created = await createFrameworkAsync(canvas, backend, (value) => {
                    fw = value;
                }, controller.signal);
                if (unmounted) {
                    return;
                }
                stopViewer = startViewer(created, createViewScenes(created), canvas);
            } catch (err) {
                if (unmounted) {
                    return;
                }
                console.error(`GPU framework initialization failed (${GpuBackend[backend]}):`, err);
                if (backend === GpuBackend.WEB_GPU) {
                    // Remounts the viewport with a new canvas and WebGL2 (this effect's cleanup disposes `fw`).
                    useViewerStore.getState().fallbackToWebGl(err);
                    return;
                }
                useViewerStore.getState().setInitError(err instanceof Error ? err.message : String(err));
            }
        })();

        return () => {
            unmounted = true;
            controller.abort();
            stopViewer?.();
            (fw as IFramework | null)?.dispose();
            canvas.remove();
        };
    }, [backend]);

    return hostRef;
}

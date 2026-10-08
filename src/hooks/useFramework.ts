import {useEffect, useRef} from "react";
import {
    Color,
    CullMode,
    Framework,
    type GameTime,
    type IFramework,
    type IMesh,
    type InspectTextureMipsMaterial,
    type OrbitCamera,
    PowerPreferenceType,
    PrimitiveStateDescriptor,
    TextureSamplerFilteringPreset,
    type UnlitMaterial,
    UnlitMaterialDescriptor
} from "ris-framework";
import {vec2, vec3} from "gl-matrix";
import {View2D, View3D} from "../model/View.ts";
import {selectSelectedTexture, useTextureStore} from "../store/TextureStore.ts";
import {useViewerStore} from "../store/viewerStore.ts";

/** GPU objects created once the framework is initialized. */
interface Scene {
    camera: OrbitCamera;
    mipMaterial: InspectTextureMipsMaterial;
    unlitMaterial: UnlitMaterial;
    quad: IMesh;
}

const INITIAL_CANVAS_WIDTH = 1920;
const INITIAL_CANVAS_HEIGHT = 1080;

function createScene(fw: IFramework): Scene {
    const camera = fw.cameraFactory.createOrbitCamera();
    camera.eye = vec3.fromValues(0, 0, -2);
    camera.sensitivity = 0.5;
    camera.scrollSpeed = 5;

    const geometry = fw.geometryBuilder.quadGeometry(vec2.fromValues(2, 2));
    const mipMaterial = fw.materialFactory.createInspectTextureMipsMaterial();

    const primitiveStateDesc = new PrimitiveStateDescriptor();
    primitiveStateDesc.cullFace = CullMode.NONE;
    const unlitMaterialDesc = new UnlitMaterialDescriptor();
    unlitMaterialDesc.primitiveState = fw.graphicsDevice.createPrimitiveState(primitiveStateDesc);
    unlitMaterialDesc.projectionViewBuffer = camera.projectionViewBuffer;
    const unlitMaterial = fw.materialFactory.createUnlitMaterial(unlitMaterialDesc);

    const quad = fw.meshFactory.create(geometry, mipMaterial.geometryFormat);

    return {camera, mipMaterial, unlitMaterial, quad};
}

function disposeScene(scene: Scene) {
    scene.camera.dispose();
    scene.mipMaterial.dispose();
    scene.unlitMaterial.dispose();
    scene.quad.dispose();
}

// TODO: Framework.dispose() is a no-op (ris-framework), so a framework's render loop cannot be stopped.
// Until it is, keep one framework per canvas and reuse it when the effect re-runs (StrictMode
// mount → cleanup → mount), instead of starting a second framework and render loop on the same canvas.
// Once dispose() works, dispose in the effect cleanup and drop this map.
const frameworksByCanvas = new WeakMap<HTMLCanvasElement, IFramework>();

/** Returns the canvas's framework, creating and initializing it on first use. Throws if WebGL2 is unavailable. */
function getOrCreateFramework(canvas: HTMLCanvasElement): IFramework {
    const existing = frameworksByCanvas.get(canvas);
    if (existing) {
        return existing;
    }

    canvas.width = INITIAL_CANVAS_WIDTH;
    canvas.height = INITIAL_CANVAS_HEIGHT;
    const fw: IFramework = new Framework({
        canvas,
        alpha: true,
        powerPreference: PowerPreferenceType.HIGH_PERFORMANCE,
        useKtx2: true,
        backBufferSize: vec2.fromValues(INITIAL_CANVAS_WIDTH, INITIAL_CANVAS_HEIGHT),
        textureFiltering: TextureSamplerFilteringPreset.TRILINEAR
    });
    fw.renderer.clearColor = new Color(0.8, 0.8, 0.8, 0.5);
    // Synchronous: creates the WebGL2 context (throws if unsupported) and starts the render loop.
    fw.initialize();

    frameworksByCanvas.set(canvas, fw);
    return fw;
}

/**
 * Creates the framework on the returned canvas ref, publishes it to ViewerStore,
 * and renders the selected texture every frame (2D mip inspection or 3D orbit view).
 * The canvas / back buffer follows the selected texture's size.
 * If the GPU cannot be initialized, the error is published as `ViewerStore.initError`.
 */
export function useFramework() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }

        let fw: IFramework;
        let scene: Scene;
        try {
            fw = getOrCreateFramework(canvas);
            scene = createScene(fw);
        } catch (err) {
            console.error("GPU framework initialization failed:", err);
            useViewerStore.getState().setInitError(err instanceof Error ? err.message : String(err));
            return;
        }

        const {camera, mipMaterial, unlitMaterial, quad} = scene;
        const previousSize = {width: 0, height: 0};

        const onUpdate = (gt: GameTime) => {
            camera.update(gt);

            const tex = selectSelectedTexture(useTextureStore.getState())?.texture;

            // If previous size is same to texture size, return as there is nothing to do.
            if (!tex || (previousSize.width === tex.width && previousSize.height === tex.height)) {
                return;
            }

            // Fit the canvas, back buffer and quad to the texture when its size changes.
            // Runs in the update phase, before the frame's render pass starts.
            previousSize.width = tex.width;
            previousSize.height = tex.height;
            canvas.width = tex.width;
            canvas.height = tex.height;
            fw.renderer.backBufferSize = vec2.fromValues(tex.width, tex.height);
        };

        const onRender = () => {
            const tex = selectSelectedTexture(useTextureStore.getState())?.texture;
            if (!tex) {
                return;
            }
            const {sampler, view} = useViewerStore.getState();
            const {mipLevel} = useTextureStore.getState();

            if (view === View2D) {
                mipMaterial.texture = tex;
                mipMaterial.textureSampler = sampler;
                mipMaterial.mipLevel = mipLevel;
                mipMaterial.beforeRender();
                mipMaterial.renderMesh(quad);
            } else if (view === View3D) {
                unlitMaterial.diffuseTexture = tex;
                unlitMaterial.diffuseTextureSampler = sampler;
                unlitMaterial.beforeRender();
                unlitMaterial.renderMesh(quad);
            }
        };

        fw.addOnUpdateListener(onUpdate);
        fw.addOnRenderListener(onRender);
        useViewerStore.getState().setFramework(fw);

        return () => {
            fw.removeOnUpdateListener(onUpdate);
            fw.removeOnRenderListener(onRender);
            disposeScene(scene);
            useViewerStore.getState().clearFramework();
            // The framework itself stays in frameworksByCanvas (see TODO above).
        };
    }, []);

    return canvasRef;
}

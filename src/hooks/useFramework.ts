import {useEffect, useRef} from "react";
import {
    Color,
    ColorSpace,
    CullMode,
    Framework,
    type GameTime,
    type IFramework,
    type InspectTextureMipsMaterial,
    type OrbitCamera,
    PowerPreferenceType,
    Scene,
    TextureSamplerFilteringPreset,
    type UnlitMaterial
} from "ris-framework";
import {vec2, vec3} from "gl-matrix";
import {View2D, View3D} from "../model/View.ts";
import {selectSelectedTexture, useTextureStore} from "../store/TextureStore.ts";
import {useViewerStore} from "../store/viewerStore.ts";

/**
 * GPU objects created once the framework is initialized.
 * The 3D view is a framework Scene holding the unlit quad and the orbit camera: the scene assigns its camera
 * to the quad's material and renders it. The 2D mip inspection is a second, camera-less Scene with the
 * InspectTextureMipsMaterial quad (it draws in clip space, so it needs no camera); keeping it in a scene too
 * gives both views the same render and dispose path.
 */
interface ViewScenes {
    camera: OrbitCamera;
    scene2D: Scene;
    scene3D: Scene;
    mipMaterial: InspectTextureMipsMaterial;
    unlitMaterial: UnlitMaterial;
}

const INITIAL_CANVAS_WIDTH = 1920;
const INITIAL_CANVAS_HEIGHT = 1080;

function createViewScenes(fw: IFramework): ViewScenes {
    const camera = fw.cameraFactory.createOrbitCamera();
    camera.setEye(vec3.fromValues(0, 0, -2));
    camera.sensitivity = 0.5;
    camera.scrollSpeed = 5;

    const geometry = fw.geometryBuilder.quadGeometry(vec2.fromValues(2, 2));

    const mipMaterial = fw.materialFactory.createInspectTextureMipsMaterial();
    const scene2D = new Scene(fw);
    scene2D.add(fw.meshFactory.create(geometry, mipMaterial));

    // Double-sided so the quad stays visible when orbiting behind it.
    const unlitMaterial = fw.materialFactory.createUnlitMaterial({
        primitiveState: fw.graphicsDevice.createPrimitiveState({cullFace: CullMode.NONE}),
    });
    const scene3D = new Scene(fw);
    scene3D.add(fw.meshFactory.create(geometry, unlitMaterial));
    // Becomes the scene camera; the scene assigns it to the quad's material.
    scene3D.add(camera);

    return {camera, scene2D, scene3D, mipMaterial, unlitMaterial};
}

/** Scenes dispose their meshes and materials; the camera is not owned by the scene. */
function disposeViewScenes(scenes: ViewScenes) {
    scenes.scene2D.dispose();
    scenes.scene3D.dispose();
    scenes.camera.dispose();
}

/**
 * Creates and initializes a framework on the canvas. Throws if WebGL2 is unavailable.
 * Each mount gets its own framework and disposes it on unmount (Framework.dispose() stops the render loop
 * and input). A StrictMode remount on the same canvas reuses its WebGL context; textures are re-uploaded
 * through moveTexturesToFramework like on a canvas change.
 */
function createFramework(canvas: HTMLCanvasElement): IFramework {

    canvas.width = INITIAL_CANVAS_WIDTH;
    canvas.height = INITIAL_CANVAS_HEIGHT;
    const fw: IFramework = new Framework({
        canvas,
        alpha: true,
        powerPreference: PowerPreferenceType.HIGH_PERFORMANCE,
        useKtx2: true,
        backBufferSize: vec2.fromValues(INITIAL_CANVAS_WIDTH, INITIAL_CANVAS_HEIGHT),
        textureFiltering: TextureSamplerFilteringPreset.TRILINEAR,
        // Linear by default; the Inspector's Display color space switch changes renderer.colorSpace at runtime.
        textureColorSpace: ColorSpace.LINEAR
    });
    fw.renderer.clearColor = new Color(0.8, 0.8, 0.8, 0.5);
    // Synchronous: creates the WebGL2 context (throws if unsupported) and starts the render loop.
    fw.initialize();

    return fw;
}

/**
 * Creates the framework on the returned canvas ref, publishes it to ViewerStore,
 * and renders the selected texture every frame (2D mip inspection or 3D orbit view).
 * The canvas / back buffer follows the selected texture's size.
 * If the GPU cannot be initialized, the error is published as `ViewerStore.initError`.
 */
/** Framework of the last mounted viewport, to detect a canvas (WebGL context) change. */
let lastFramework: IFramework | null = null;

export function useFramework() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) {
            return;
        }

        let fw: IFramework;
        let scenes: ViewScenes;
        try {
            fw = createFramework(canvas);
            scenes = createViewScenes(fw);
        } catch (err) {
            console.error("GPU framework initialization failed:", err);
            useViewerStore.getState().setInitError(err instanceof Error ? err.message : String(err));
            return;
        }

        const {camera, scene2D, scene3D, mipMaterial, unlitMaterial} = scenes;
        const previousSize = {width: 0, height: 0};

        const onUpdate = (gt: GameTime) => {
            // Orbit input (the scene does not drive camera controllers), then scene transforms and camera binding.
            camera.update(gt);
            scene3D.update(gt);
            scene2D.update(gt);

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
                scene2D.render();
            } else if (view === View3D) {
                unlitMaterial.diffuseTexture = tex;
                unlitMaterial.diffuseTextureSampler = sampler;
                scene3D.render();
            }
        };

        fw.addOnUpdateListener(onUpdate);
        fw.addOnRenderListener(onRender);
        useViewerStore.getState().setFramework(fw);
        // A remounted viewport (layout switch at the md breakpoint) gets a new canvas and WebGL context.
        if (lastFramework && lastFramework !== fw) {
            useTextureStore.getState().moveTexturesToFramework(fw);
        }
        lastFramework = fw;

        return () => {
            fw.removeOnUpdateListener(onUpdate);
            fw.removeOnRenderListener(onRender);
            disposeViewScenes(scenes);
            useViewerStore.getState().clearFramework();
            fw.dispose();
        };
    }, []);

    return canvasRef;
}

import {useEffect, useRef} from "react";
import {
    Color,
    CullMode,
    type IFramework,
    type IMesh,
    type ITexture2D,
    type InspectTextureMipsMaterial,
    type OrbitCamera,
    PrimitiveStateDescriptor,
    type UnlitMaterial,
    UnlitMaterialDescriptor
} from "ris-framework-api";
import {Framework, TextureSamplerFilteringPreset} from "ris-framework";
import {mat4, vec2, vec3} from "gl-matrix";
import {View2D, View3D} from "../model/View.ts";
import {useTextureStore} from "../store/TextureStore.ts";
import {useViewerStore} from "../store/ViewerStore.ts";

/** GPU objects created once the framework is initialized. */
interface Scene {
    camera: OrbitCamera;
    mipMaterial: InspectTextureMipsMaterial;
    unlitMaterial: UnlitMaterial;
    quad: IMesh;
}

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

/**
 * Creates the framework on the returned canvas ref, publishes it to ViewerStore,
 * and renders the selected texture every frame (2D mip inspection or 3D orbit view).
 * The canvas / back buffer follows the selected texture's size.
 */
export function useFramework() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const frameworkRef = useRef<IFramework | null>(null);

    // Resize canvas / back buffer whenever the displayed GPU texture changes
    // (new selection, or the selected texture was recreated).
    useEffect(() => {
        let lastTexture: ITexture2D | null | undefined = undefined;
        return useTextureStore.subscribe(({selectedTexture}) => {
            const texture = selectedTexture?.texture;
            if (texture === lastTexture) {
                return;
            }
            lastTexture = texture;
            if (!texture) {
                return;
            }

            const canvas = canvasRef.current;
            if (canvas) {
                canvas.width = texture.width;
                canvas.height = texture.height;
            }
            const fw = frameworkRef.current;
            if (fw) {
                fw.renderer.backBufferSize = vec2.fromValues(texture.width, texture.height);
            }
        });
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || frameworkRef.current) {
            return;
        }

        let scene: Scene | null = null;
        const modelMatrix = mat4.create();
        const previousSize = {width: 0, height: 0};

        const fw: IFramework = new Framework({
            canvas,
            useKtx2: true,
            backBufferSize: vec2.fromValues(1920, 1080),
            textureFiltering: TextureSamplerFilteringPreset.TRILINEAR
        });
        fw.renderer.clearColor = Color.gray();

        fw.addOnInitializedListener(() => {
            scene = createScene(fw);
        });

        fw.addOnUpdateListener(gt => {
            scene?.camera.update(gt);
        });

        fw.addOnRenderListener(() => {
            const tex = useTextureStore.getState().selectedTexture?.texture;
            const {sampler, view, mipLevel} = useViewerStore.getState();
            if (!tex || !scene) {
                return;
            }
            const {mipMaterial, unlitMaterial, quad} = scene;

            // Fit the quad (and canvas aspect ratio) to the texture when its size changes.
            if (previousSize.width !== tex.width || previousSize.height !== tex.height) {
                previousSize.width = tex.width;
                previousSize.height = tex.height;

                const aspectRatio = tex.width / tex.height;
                const widthScale = aspectRatio > 1 ? 1 : aspectRatio;
                const heightScale = aspectRatio > 1 ? 1 / aspectRatio : 1;
                canvas.style.aspectRatio = aspectRatio.toString();

                // Reset scale each time (do not accumulate).
                mat4.fromScaling(modelMatrix, vec3.fromValues(widthScale, heightScale, 1));
                mipMaterial.modelMatrix = modelMatrix;
                unlitMaterial.modelMatrix = modelMatrix;
            }

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
        });

        fw.initialize();
        frameworkRef.current = fw;
        useViewerStore.getState().setFramework(fw);

        return () => {
            // Framework has no dispose API for these; dispose the GPU objects we created.
            scene?.mipMaterial.dispose();
            scene?.unlitMaterial.dispose();
            scene?.quad.dispose();
            scene = null;
            fw.dispose();
            frameworkRef.current = null;
        };
    }, []);

    return canvasRef;
}

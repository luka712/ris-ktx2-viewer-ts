import {type IFramework, type ITexture2D, TextureDescriptor, TextureFormat, TextureUsage,} from "ris-framework-api";
import {create} from "zustand";
import type {ITexture2DContainer} from "../model/ITexture2DContainer.ts";
import {decodeImageAsync, isDecodableImage, isKtx2File} from "../service/TextureUtilities.ts";
import {VkFormat} from "ris-ktx2-api";
import {useViewerStore} from "./ViewerStore.ts";

/**
 * Loaded textures, the current selection and its derived metrics / GPU format settings.
 * The framework comes from ViewerStore.
 */
interface TextureStore {
    textures: ITexture2DContainer[];
    selectedTexture: ITexture2DContainer | null;

    // Derived from the selected texture.
    textureFormat: TextureFormat;
    generateMipmaps: boolean;
    resolution: string;
    size: string;
    mipLevels: number;

    setSelectedTexture: (texture: ITexture2DContainer | null) => void;
    addTexture: (file: File | ITexture2DContainer) => Promise<void>;
    removeTexture: (texContainer: ITexture2DContainer) => void;
    setTextureFormat: (value: TextureFormat) => void;
    setGenerateMipmaps: (value: boolean) => void;
    canGenerateMipmaps: () => boolean;
}

const DEFAULT_USAGE = TextureUsage.TEXTURE_BINDING | TextureUsage.COPY_DST;

function formatSizeMiB(bytes: number): string {
    return `${(bytes / (1024 * 1024)).toPrecision(3)} MiB`;
}

function metricsFromTexture(texture: ITexture2D | null | undefined) {
    if (!texture) {
        return {resolution: "0x0", size: "0 MiB", mipLevels: 0};
    }

    return {
        resolution: `${texture.width}x${texture.height}`,
        size: formatSizeMiB(texture.size),
        mipLevels: texture.mipLevels,
    };
}


function recreateTexture(
    framework: IFramework,
    container: ITexture2DContainer,
    textureFormat: TextureFormat,
    generateMipmaps: boolean,
): ITexture2D | null {
    const image = container.image;
    const ktx2 = container.ktxContainer;
    let texture = null;

    if(ktx2) {
        container.texture?.dispose();
        const desc = new TextureDescriptor();
        desc.textureFormat = textureFormat;
        desc.generateMipmaps = generateMipmaps;
        // Always use copy to be able to change texture format.
        const copy = ktx2.createCopy();
        texture = framework.textureFactory.createFromKtx2(copy, desc);
        copy.delete();
    }
    else if (image) {
        container.texture?.dispose();

        texture = framework.textureFactory.create(
            image.baseWidth,
            image.baseHeight,
            image.getData(0),
            4,
            container.name,
            DEFAULT_USAGE,
            textureFormat,
            generateMipmaps,
        );
    }
    
    container.texture = texture;
    return texture;
}

const getFramework = () => useViewerStore.getState().framework;

export const useTextureStore = create<TextureStore>((set, get) => {
    const applySelection = (tex: ITexture2DContainer | null) => {
        set({
            selectedTexture: tex,
            ...metricsFromTexture(tex?.texture),
            textureFormat: tex?.texture?.textureFormat ?? get().textureFormat,
            generateMipmaps: (tex?.texture?.mipLevels ?? 1) > 1,
        });
    };

    return {
        textures: [],
        selectedTexture: null,

        textureFormat: TextureFormat.RGBA_8_UNORM,
        generateMipmaps: false,
        resolution: "0x0",
        size: "0 MiB",
        mipLevels: 1,

        setSelectedTexture: (tex) => applySelection(tex),

        removeTexture: (texture) => {
            const {textures, selectedTexture} = get();
            const nextTextures = textures.filter((t) => t !== texture);

            texture.texture?.dispose();

            set({textures: nextTextures});

            if (selectedTexture === texture) {
                applySelection(nextTextures[0] ?? null);
            }
        },

        addTexture: async (file) => {

            const framework = getFramework();

            if(!framework) {
                // This should never happen
                throw new Error("Framework has not been initialized");
            }

            if(file instanceof File) {

                if (get().textures.some((t) => t.name === file.name)) {
                    console.warn(`Texture already added: ${file.name}`);
                    return;
                }

                let container: ITexture2DContainer;

                if (isDecodableImage(file)) {
                    const image = await decodeImageAsync(framework, file);
                    const texture = framework.textureFactory.create(
                        image.baseWidth,
                        image.baseHeight,
                        image.getData(0)!,
                        image.channels,
                        file.name,
                    );

                    container = {
                        name: file.name,
                        texture,
                        image,
                        ktxContainer: null,
                    };
                } else if (isKtx2File(file)) {
                    const ktx = await framework.ktx2Factory!.loadAsync(file);
                    const copy = ktx.createCopy();
                    const texture = framework.textureFactory.createFromKtx2(copy);
                    copy.delete();

                    container = {
                        name: file.name,
                        texture,
                        ktxContainer: ktx,
                        image: null,
                    };
                } else {
                    throw new Error(`Unsupported file type: ${file.name}`);
                }

                set((state) => ({
                    textures: [...state.textures, container],
                    mipLevels: container.texture?.mipLevels ?? 1,
                }));
                applySelection(container);
            }
            else {
                set((state) => ({
                    textures: [...state.textures, file],
                    mipLevels: file.texture?.mipLevels ?? 1,
                    format: file.texture?.textureFormat ?? TextureFormat.RGBA_8_UNORM,
                }));
                applySelection(file);
            }
        },

        setTextureFormat: (value) => {
            const framework = getFramework();
            const {selectedTexture, generateMipmaps} = get();
            if (!framework || !selectedTexture) {
                return;
            }

            set({textureFormat: value});
            recreateTexture(framework, selectedTexture, value, generateMipmaps && get().canGenerateMipmaps());
            applySelection(selectedTexture);
        },

        setGenerateMipmaps: (value) => {
            const framework = getFramework();
            const {selectedTexture, textureFormat} = get();
            if (!framework || !selectedTexture) {
                return;
            }

            set({generateMipmaps: value});
            recreateTexture(framework, selectedTexture, textureFormat, value && get().canGenerateMipmaps());
            applySelection(selectedTexture);
        },

        canGenerateMipmaps: () => {
            const ktx = get().selectedTexture?.ktxContainer;
            const textureFormat = get().textureFormat;
            return !ktx || ktx.vkFormat === VkFormat.R8G8B8A8_UNORM || textureFormat === TextureFormat.RGBA_8_UNORM;
        }
    };
});

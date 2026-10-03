import {type IFramework, type ITexture2D, TextureDescriptor, TextureFormat, TextureUsage,} from "ris-framework-api";
import {create} from "zustand";
import type {ITexture2DContainer} from "../model/ITexture2DContainer.ts";
import {decodeImageAsync, isDecodableImage, isKtx2File} from "../service/TextureUtilities.ts";
import {VkFormat} from "ris-ktx2-api";
import {useViewerStore} from "./ViewerStore.ts";

/**
 * Loaded textures and the current selection.
 * Resolution, byte size, mip count, GPU format, and the mipmap checkbox are
 * read from the selected texture at render time (see `textureDetails`).
 * The framework comes from ViewerStore.
 */
interface TextureStore {
    textures: ITexture2DContainer[];
    selectedTexture: ITexture2DContainer | null;

    setSelectedTexture: (texture: ITexture2DContainer | null) => void;
    addTexture: (file: File | ITexture2DContainer) => Promise<void>;
    removeTexture: (texContainer: ITexture2DContainer) => void;
    setTextureFormat: (value: TextureFormat) => void;
    setGenerateMipmaps: (value: boolean) => void;
    canGenerateMipmaps: () => boolean;
}

/** Display values derived from a GPU texture. Not stored separately. */
export interface TextureDetails {
    textureFormat: TextureFormat;
    generateMipmaps: boolean;
    resolution: string;
    size: string;
    mipLevels: number;
}

const DEFAULT_USAGE = TextureUsage.TEXTURE_BINDING | TextureUsage.COPY_DST;

function formatSizeMiB(bytes: number): string {
    return `${(bytes / (1024 * 1024)).toPrecision(3)} MiB`;
}

export function textureDetails(texture: ITexture2D | null | undefined): TextureDetails {
    if (!texture) {
        return {
            textureFormat: TextureFormat.RGBA_8_UNORM,
            generateMipmaps: false,
            resolution: "0x0",
            size: "0 MiB",
            mipLevels: 0,
        };
    }

    return {
        textureFormat: texture.textureFormat,
        generateMipmaps: texture.mipLevels > 1,
        resolution: `${texture.width}x${texture.height}`,
        size: formatSizeMiB(texture.size),
        mipLevels: texture.mipLevels,
    };
}

function mipmapsAllowed(container: ITexture2DContainer | null, textureFormat: TextureFormat): boolean {
    const ktx = container?.ktxContainer;
    return !ktx || ktx.vkFormat === VkFormat.R8G8B8A8_UNORM || textureFormat === TextureFormat.RGBA_8_UNORM;
}

function recreateTexture(
    framework: IFramework,
    container: ITexture2DContainer,
    textureFormat: TextureFormat,
    generateMipmaps: boolean,
): ITexture2D | null {
    const image = container.image;
    const ktx2 = container.ktxContainer;
    container.texture?.dispose();

    if (ktx2) {
        const desc = new TextureDescriptor();
        desc.textureFormat = textureFormat;
        desc.generateMipmaps = generateMipmaps;
        // Always use copy to be able to change texture format.
        const copy = ktx2.createCopy();
        const texture = framework.textureFactory.createFromKtx2(copy, desc);
        copy.delete();
        return texture;
    }

    if (image) {
        return framework.textureFactory.create(
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

    return null;
}

const getFramework = () => useViewerStore.getState().framework;

function resetMipLevel() {
    useViewerStore.getState().setMipLevel(0);
}

function clampMipLevel(mipLevels: number) {
    const levels = Math.max(mipLevels, 1);
    if (useViewerStore.getState().mipLevel >= levels) {
        resetMipLevel();
    }
}

export const useTextureStore = create<TextureStore>((set, get) => {
    const selectTexture = (tex: ITexture2DContainer | null) => {
        if (get().selectedTexture === tex) {
            return;
        }
        set({selectedTexture: tex});
        resetMipLevel();
    };

    const publishTexture = (previous: ITexture2DContainer, texture: ITexture2D | null) => {
        const next: ITexture2DContainer = {...previous, texture};
        const {textures, selectedTexture} = get();
        set({
            textures: textures.map((item) => item === previous ? next : item),
            selectedTexture: selectedTexture === previous ? next : selectedTexture,
        });
        clampMipLevel(texture?.mipLevels ?? 1);
    };

    return {
        textures: [],
        selectedTexture: null,

        setSelectedTexture: (tex) => selectTexture(tex),

        removeTexture: (texture) => {
            const {textures, selectedTexture} = get();
            const nextTextures = textures.filter((item) => item !== texture);
            const removingSelection = selectedTexture === texture;

            texture.texture?.dispose();
            set({
                textures: nextTextures,
                ...(removingSelection ? {selectedTexture: nextTextures[0] ?? null} : {}),
            });

            if (removingSelection) {
                resetMipLevel();
            }
        },

        addTexture: async (file) => {
            const framework = getFramework();

            if (!framework) {
                // This should never happen
                throw new Error("Framework has not been initialized");
            }

            if (file instanceof File) {
                if (get().textures.some((item) => item.name === file.name)) {
                    throw new Error(`Texture already added: ${file.name}`);
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
                    selectedTexture: container,
                }));
                resetMipLevel();
            } else {
                set((state) => ({
                    textures: [...state.textures, file],
                    selectedTexture: file,
                }));
                resetMipLevel();
            }
        },

        setTextureFormat: (value) => {
            const framework = getFramework();
            const selected = get().selectedTexture;
            if (!framework || !selected) {
                return;
            }

            const generateMipmaps = (selected.texture?.mipLevels ?? 1) > 1;
            const texture = recreateTexture(
                framework,
                selected,
                value,
                generateMipmaps && mipmapsAllowed(selected, value),
            );
            publishTexture(selected, texture);
        },

        setGenerateMipmaps: (value) => {
            const framework = getFramework();
            const selected = get().selectedTexture;
            if (!framework || !selected) {
                return;
            }

            const textureFormat = selected.texture?.textureFormat ?? TextureFormat.RGBA_8_UNORM;
            const texture = recreateTexture(
                framework,
                selected,
                textureFormat,
                value && mipmapsAllowed(selected, textureFormat),
            );
            publishTexture(selected, texture);
        },

        canGenerateMipmaps: () => {
            const selected = get().selectedTexture;
            const textureFormat = selected?.texture?.textureFormat ?? TextureFormat.RGBA_8_UNORM;
            return mipmapsAllowed(selected, textureFormat);
        },
    };
});

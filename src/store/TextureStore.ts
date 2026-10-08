import {type IFramework, type ITexture2D, TextureFormat} from "ris-framework";
import {create} from "zustand";
import {type IKtx2Texture, VkFormat} from "ris-ktx2";
import type {ITexture2DContainer} from "../model/ITexture2DContainer.ts";
import {
    createTextureFromKtx2,
    createTextureId,
    loadTextureFromFileAsync,
    recreateTexture,
} from "../service/textureResources.ts";
import {useViewerStore} from "./viewerStore.ts";
import {makeUniqueName} from "../service/formatter.ts";

/**
 * Loaded textures, the current selection (by id) and the displayed mip level.
 * Resolution, byte size, mip count, GPU format, and the mipmap checkbox are
 * read from the selected texture at render time (see `textureDetails`).
 * The framework comes from ViewerStore; GPU resources are created in TextureResources.
 */
interface TextureStore {
    textures: ITexture2DContainer[];
    selectedId: string | null;
    /** Mip level shown in the 2D view. Reset whenever the selection changes. */
    mipLevel: number;

    selectTexture: (id: string | null) => void;
    /** Decodes / loads a picked file and selects it. Rejects on duplicates or unsupported files. */
    addTextureFromFile: (file: File) => Promise<void>;
    /**
     * Adds an already-loaded KTX2 texture and takes ownership of `ktx` (deleted on failure).
     * The name is made unique (`name (2).ktx2`, …); the name used is returned.
     * With `select: false` the current selection and mip level are kept (unless nothing is selected).
     */
    addKtx2Texture: (name: string, ktx: IKtx2Texture, options?: { select?: boolean }) => string;
    /** `name`, or `name (2)`, `name (3)`, … if a loaded or loading texture already uses it. */
    uniqueTextureName: (name: string) => string;
    removeTexture: (id: string) => void;
    /** Recreates the selected GPU texture. Throws if that fails; the current texture is kept. */
    setTextureFormat: (value: TextureFormat) => void;
    /** Recreates the selected GPU texture. Throws if that fails; the current texture is kept. */
    setGenerateMipmaps: (value: boolean) => void;
    setMipLevel: (mipLevel: number) => void;
}

/** Display values derived from a GPU texture. Not stored separately. */
export interface TextureDetails {
    textureFormat: TextureFormat;
    generateMipmaps: boolean;
    resolution: string;
    size: string;
    mipLevels: number;
}

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

/** Whether "Generate Mipmaps" applies to the texture in its current GPU format. */
export function canGenerateMipmaps(container: ITexture2DContainer | null): boolean {
    const textureFormat = container?.texture?.textureFormat ?? TextureFormat.RGBA_8_UNORM;
    return mipmapsAllowed(container, textureFormat);
}

type TextureState = Pick<TextureStore, "textures" | "selectedId">;

/** The selected texture container (stable reference from `textures`). */
export const selectSelectedTexture = (state: TextureState): ITexture2DContainer | null =>
    state.textures.find((item) => item.id === state.selectedId) ?? null;

function requireFramework(): IFramework {
    const framework = useViewerStore.getState().framework;
    if (!framework) {
        // This should never happen
        throw new Error("Framework has not been initialized");
    }
    return framework;
}

/** File names currently being loaded, so a quick double pick is still rejected as a duplicate. */
const pendingFileNames = new Set<string>();

export const useTextureStore = create<TextureStore>((set, get) => {
    const addContainer = (container: ITexture2DContainer, select = true) => {
        set((state) => select || state.selectedId === null
            ? {textures: [...state.textures, container], selectedId: container.id, mipLevel: 0}
            : {textures: [...state.textures, container]});
    };

    const isNameTaken = (name: string) =>
        pendingFileNames.has(name) || get().textures.some((item) => item.name === name);

    /** Replaces the container's GPU texture (disposing the old one) and clamps the mip level. */
    const replaceTexture = (container: ITexture2DContainer, texture: ITexture2D | null) => {
        container.texture?.dispose();
        const next: ITexture2DContainer = {...container, texture};
        const levels = Math.max(texture?.mipLevels ?? 1, 1);
        set((state) => ({
            textures: state.textures.map((item) => item.id === container.id ? next : item),
            mipLevel: state.mipLevel >= levels ? 0 : state.mipLevel,
        }));
    };

    return {
        textures: [],
        selectedId: null,
        mipLevel: 0,

        selectTexture: (id) => {
            if (get().selectedId === id) {
                return;
            }
            set({selectedId: id, mipLevel: 0});
        },

        removeTexture: (id) => {
            const {textures, selectedId} = get();
            const texture = textures.find((item) => item.id === id);
            if (!texture) {
                return;
            }
            const nextTextures = textures.filter((item) => item.id !== id);

            // TODO: The GPU texture is disposed here; the source image and KTX2 container are not.
            texture.texture?.dispose();
            set(selectedId === id
                ? {textures: nextTextures, selectedId: nextTextures[0]?.id ?? null, mipLevel: 0}
                : {textures: nextTextures});
        },

        addTextureFromFile: async (file) => {
            const framework = requireFramework();
            if (isNameTaken(file.name)) {
                throw new Error(`Texture already added: ${file.name}`);
            }

            pendingFileNames.add(file.name);
            try {
                const loaded = await loadTextureFromFileAsync(framework, file);
                addContainer({id: createTextureId(), ...loaded});
            } finally {
                pendingFileNames.delete(file.name);
            }
        },

        addKtx2Texture: (name, ktx, options) => {
            let texture: ITexture2D;
            try {
                texture = createTextureFromKtx2(requireFramework(), ktx);
            } catch (err) {
                ktx.delete();
                throw err;
            }
            const uniqueName = makeUniqueName(name, isNameTaken);
            addContainer({id: createTextureId(), name: uniqueName, texture, ktxContainer: ktx, image: null},
                options?.select ?? true);
            return uniqueName;
        },

        uniqueTextureName: (name) => makeUniqueName(name, isNameTaken),

        setTextureFormat: (value) => {
            const framework = useViewerStore.getState().framework;
            const selected = selectSelectedTexture(get());
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
            replaceTexture(selected, texture);
        },

        setGenerateMipmaps: (value) => {
            const framework = useViewerStore.getState().framework;
            const selected = selectSelectedTexture(get());
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
            replaceTexture(selected, texture);
        },

        setMipLevel: (mipLevel) => set({mipLevel}),
    };
});

/** The selected texture container, or null. */
export const useSelectedTexture = () => useTextureStore(selectSelectedTexture);

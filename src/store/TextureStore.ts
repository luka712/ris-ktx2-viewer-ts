import {ColorSpace, type IFramework, TextureFormat, TextureUtilities} from "ris-framework";
import {create} from "zustand";
import {useShallow} from "zustand/react/shallow";
import {VkFormat} from "ris-ktx2";
import type {FrameworkKtx2Texture} from "../model/FrameworkKtx2.ts";
import type {ITexture2DContainer, ViewerTexture} from "../model/ITexture2DContainer.ts";
import {
    createTextureForKtx2,
    createTextureId,
    fileColorSpace,
    isPvrtcFormat,
    isRgba8Format,
    ktx2LayerCount,
    loadTextureFromFileAsync,
    recreateTexture,
    rgba8Format,
} from "../service/textureResources.ts";
import {applyOutputColorSpace} from "../service/outputColorSpace.ts";
import {useViewerStore, waitForFrameworkAsync} from "./viewerStore.ts";
import {makeUniqueName} from "../service/formatter.ts";

/**
 * Loaded textures, the current selection (by id) and the displayed mip level.
 * `selectedId` is the active texture (viewport, Inspector); `selectedIds` is the multi-selection
 * (Ctrl/Cmd-click, Shift-click) used by Convert, and always contains `selectedId` when it is set.
 * Resolution, byte size, mip count, GPU format, and the mipmap checkbox are
 * read from the selected texture at render time (see `textureDetails`).
 * The framework comes from ViewerStore; GPU resources are created in TextureResources.
 */
interface TextureStore {
    textures: ITexture2DContainer[];
    selectedId: string | null;
    /** Multi-selection, including `selectedId`. Order is not meaningful; use `selectSelectedTextures` for list order. */
    selectedIds: string[];
    /** Start of a Shift-click range (the last plainly clicked or toggled texture). */
    selectionAnchorId: string | null;
    /** Mip level shown in the 2D view. Reset whenever the selection changes. */
    mipLevel: number;
    /** Array layer shown for a texture array (2D: material uniform; 3D: see useFramework). Reset with the selection. */
    layer: number;

    /** Selects only `id` (plain click) and makes it the active texture. */
    selectTexture: (id: string | null) => void;
    /**
     * Ctrl/Cmd-click: adds `id` to the selection (and makes it active) or removes it. The last selected
     * texture can't be removed this way, so something stays displayed.
     */
    toggleTextureSelection: (id: string) => void;
    /** Shift-click: selects the list range from the anchor to `id` and makes `id` active. */
    selectTextureRange: (id: string) => void;
    /** Decodes / loads a picked file and selects it. Rejects on duplicates or unsupported files. */
    addTextureFromFile: (file: File) => Promise<void>;
    /**
     * Adds an already-loaded KTX2 texture and takes ownership of `ktx` (deleted on failure).
     * The name is made unique (`name (2).ktx2`, …); the name used is returned.
     * With `select: false` the current selection and mip level are kept (unless nothing is selected).
     */
    addKtx2Texture: (name: string, ktx: FrameworkKtx2Texture, options?: { select?: boolean; fileSize?: number }) => string;
    /** `name`, or `name (2)`, `name (3)`, … if a loaded or loading texture already uses it. */
    uniqueTextureName: (name: string) => string;
    removeTexture: (id: string) => void;
    /** Recreates the selected GPU texture. Throws if that fails; the current texture is kept. */
    setTextureFormat: (value: TextureFormat) => void;
    /** Switches the Display color space (sRGB | Linear): renderer output and clear color only, saved. */
    applyDisplayColorSpace: (colorSpace: ColorSpace) => void;
    /**
     * Re-uploads every texture to a new framework. The viewport remounts its canvas when the layout switches
     * between desktop and mobile (md breakpoint) and on a backend switch (WebGL2 | WebGPU), which creates a new
     * context / device; textures from the old one can't be bound there and the viewport goes blank.
     * Selection, mip level (clamped), layer and color space are kept; a format the new backend doesn't support
     * (e.g. PVRTC on WebGPU) falls back to the framework's pick (KTX2) or RGBA8 (images).
     */
    moveTexturesToFramework: (framework: IFramework) => void;
    /** Recreates the selected GPU texture. Throws if that fails; the current texture is kept. */
    setGenerateMipmaps: (value: boolean) => void;
    setMipLevel: (mipLevel: number) => void;
    /** Shows another layer of the selected texture array (clamped). The array is uploaded once; nothing is re-uploaded. */
    setLayer: (layer: number) => void;
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

/** Source file size: KiB below 1 MiB, otherwise MiB (same precision as GPU memory); "—" if unknown. */
export function formatFileSize(bytes: number | undefined): string {
    if (bytes === undefined) {
        return "—";
    }
    return bytes < 1024 * 1024 ? `${(bytes / 1024).toPrecision(3)} KiB` : formatSizeMiB(bytes);
}

export function textureDetails(texture: ViewerTexture | null | undefined): TextureDetails {
    if (!texture) {
        return {
            textureFormat: TextureFormat.RGBA8_UNORM,
            generateMipmaps: false,
            resolution: "0x0",
            size: "0 MiB",
            mipLevels: 0,
        };
    }

    return {
        textureFormat: texture.textureFormat,
        generateMipmaps: texture.mipLevels > 1,
        resolution: `${texture.size[0]}x${texture.size[1]}`,
        size: formatSizeMiB(texture.vramSize),
        mipLevels: texture.mipLevels,
    };
}

/**
 * Whether "Generate mipmaps on GPU" applies to the texture in `textureFormat`.
 * The framework generates mipmaps for RGBA8 (linear or sRGB) only: images, uncompressed KTX2, and Basis
 * transcoded to RGBA8. Texture arrays: only when the file has a single level (createTexture2DArrayFromKtx2
 * `generateMipmaps`).
 * Local ris-framework (0.4.0 working tree) generates the 2D chain on WebGL2 and WebGPU for RGBA8 /
 * RGBA8 sRGB; see ai-guide/TODO-webgpu-framework.md #1 (verified locally, pending npm release).
 */
function mipmapsAllowed(container: ITexture2DContainer | null, textureFormat: TextureFormat): boolean {
    const ktx = container?.ktxContainer;
    if (ktx?.isArray) {
        return ktx.numLevels <= 1 && isRgba8Format(textureFormat);
    }
    return !ktx
        || ktx.vkFormat === VkFormat.R8G8B8A8_UNORM || ktx.vkFormat === VkFormat.R8G8B8A8_SRGB
        || isRgba8Format(textureFormat);
}

/** Whether "Generate Mipmaps" applies to the texture in its current GPU format. */
export function canGenerateMipmaps(container: ITexture2DContainer | null): boolean {
    const textureFormat = container?.texture?.textureFormat ?? TextureFormat.RGBA8_UNORM;
    return mipmapsAllowed(container, textureFormat);
}

type TextureState = Pick<TextureStore, "textures" | "selectedId">;

/** The selected texture container (stable reference from `textures`). */
export const selectSelectedTexture = (state: TextureState): ITexture2DContainer | null =>
    state.textures.find((item) => item.id === state.selectedId) ?? null;

/** Every selected texture, in list order (a new array: use with `useShallow`, see `useSelectedTextures`). */
export const selectSelectedTextures = (state: Pick<TextureStore, "textures" | "selectedIds">): ITexture2DContainer[] =>
    state.textures.filter((item) => state.selectedIds.includes(item.id));

/** Number of array layers (0 for a plain 2D texture). */
export function arrayLayerCount(container: ITexture2DContainer | null | undefined): number {
    return ktx2LayerCount(container?.ktxContainer);
}

/** The texture's sRGB / linear choice; by default sRGB for images and the file's own color space for KTX2. */
export function textureColorSpace(container: ITexture2DContainer): ColorSpace {
    if (container.textureColorSpace) {
        return container.textureColorSpace;
    }
    return container.ktxContainer ? fileColorSpace(container.ktxContainer) : ColorSpace.SRGB;
}

/** Whether `format` has an sRGB / linear pair (PVRTC, for example, has none). */
export function hasSrgbPair(format: TextureFormat): boolean {
    return TextureUtilities.isSrgbFormat(format) || TextureUtilities.convertToSrgbVariant(format) !== format;
}

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
            ? {
                textures: [...state.textures, container],
                selectedId: container.id,
                selectedIds: [container.id],
                selectionAnchorId: container.id,
                mipLevel: 0,
                layer: 0,
            }
            : {textures: [...state.textures, container]});
    };

    /** Makes `id` the active texture (mip level resets when it changes). */
    const activate = (id: string | null, selectedIds: string[], selectionAnchorId: string | null) => {
        set((state) => state.selectedId === id
            ? {selectedIds, selectionAnchorId}
            : {selectedId: id, selectedIds, selectionAnchorId, mipLevel: 0, layer: 0});
    };

    const isNameTaken = (name: string) =>
        pendingFileNames.has(name) || get().textures.some((item) => item.name === name);

    /** Replaces the container's GPU texture (the old one is disposed after this frame is submitted) and clamps the mip level. */
    const replaceTexture = (container: ITexture2DContainer, texture: ViewerTexture | null, changes?: Partial<ITexture2DContainer>) => {
        container.texture?.queueDispose();
        const next: ITexture2DContainer = {...container, ...changes, texture};
        const levels = Math.max(texture?.mipLevels ?? 1, 1);
        set((state) => ({
            textures: state.textures.map((item) => item.id === container.id ? next : item),
            mipLevel: state.mipLevel >= levels ? 0 : state.mipLevel,
        }));
    };

    return {
        textures: [],
        selectedId: null,
        selectedIds: [],
        selectionAnchorId: null,
        mipLevel: 0,
        layer: 0,

        selectTexture: (id) => {
            const {selectedId, selectedIds} = get();
            if (selectedId === id && selectedIds.length === (id === null ? 0 : 1)) {
                return;
            }
            activate(id, id === null ? [] : [id], id);
        },

        toggleTextureSelection: (id) => {
            const {selectedId, selectedIds, textures} = get();
            if (!textures.some((item) => item.id === id)) {
                return;
            }
            if (!selectedIds.includes(id)) {
                activate(id, [...selectedIds, id], id);
                return;
            }
            if (selectedIds.length === 1) {
                return;
            }
            const remaining = selectedIds.filter((item) => item !== id);
            activate(selectedId === id ? remaining[remaining.length - 1] : selectedId, remaining, id);
        },

        selectTextureRange: (id) => {
            const {textures, selectionAnchorId, selectedId} = get();
            const to = textures.findIndex((item) => item.id === id);
            if (to < 0) {
                return;
            }
            const anchorIndex = textures.findIndex((item) => item.id === (selectionAnchorId ?? selectedId));
            const from = anchorIndex < 0 ? to : anchorIndex;
            const range = textures.slice(Math.min(from, to), Math.max(from, to) + 1).map((item) => item.id);
            // The anchor stays, so a second Shift-click changes the range instead of extending it.
            activate(id, range, textures[from].id);
        },

        removeTexture: (id) => {
            const {textures, selectedId} = get();
            const texture = textures.find((item) => item.id === id);
            if (!texture) {
                return;
            }
            const nextTextures = textures.filter((item) => item.id !== id);

            // TODO: The GPU texture is disposed here; the source image and KTX2 container are not.
            texture.texture?.queueDispose();
            const {selectedIds, selectionAnchorId} = get();
            const nextSelectedIds = selectedIds.filter((item) => item !== id);
            const anchor = selectionAnchorId === id ? null : selectionAnchorId;
            if (selectedId === id) {
                const next = nextTextures[0]?.id ?? null;
                set({
                    textures: nextTextures,
                    selectedId: next,
                    selectedIds: next === null ? [] : [next],
                    selectionAnchorId: next,
                    mipLevel: 0,
                    layer: 0,
                });
            } else {
                set({textures: nextTextures, selectedIds: nextSelectedIds, selectionAnchorId: anchor});
            }
        },

        addTextureFromFile: async (file) => {
            if (isNameTaken(file.name)) {
                throw new Error(`Texture already added: ${file.name}`);
            }

            pendingFileNames.add(file.name);
            try {
                // Wait if the canvas is being recreated (backend switch, layout remount, first start).
                const framework = await waitForFrameworkAsync();
                const loaded = await loadTextureFromFileAsync(framework, file);
                addContainer({id: createTextureId(), ...loaded});
            } finally {
                pendingFileNames.delete(file.name);
            }
        },

        addKtx2Texture: (name, ktx, options) => {
            let texture: ViewerTexture;
            try {
                texture = createTextureForKtx2(requireFramework(), ktx, fileColorSpace(ktx));
            } catch (err) {
                ktx.delete();
                throw err;
            }
            const uniqueName = makeUniqueName(name, isNameTaken);
            addContainer({
                id: createTextureId(),
                name: uniqueName,
                texture,
                ktxContainer: ktx,
                image: null,
                fileSize: options?.fileSize,
            }, options?.select ?? true);
            return uniqueName;
        },

        uniqueTextureName: (name) => makeUniqueName(name, isNameTaken),

        setTextureFormat: (value) => {
            const framework = useViewerStore.getState().framework;
            const selected = selectSelectedTexture(get());
            if (!framework || !selected) {
                return;
            }

            // The picked format is used as-is (sRGB or UNORM) and its color space is kept on the texture. Formats
            // without an sRGB pair (PVRTC) keep the texture's current choice.
            const colorSpace = hasSrgbPair(value)
                ? (TextureUtilities.isSrgbFormat(value) ? ColorSpace.SRGB : ColorSpace.LINEAR)
                : textureColorSpace(selected);
            const generateMipmaps = (selected.texture?.mipLevels ?? 1) > 1;
            const texture = recreateTexture(
                framework,
                selected,
                value,
                generateMipmaps && mipmapsAllowed(selected, value),
                colorSpace,
            );
            replaceTexture(selected, texture, {textureColorSpace: colorSpace});
        },

        applyDisplayColorSpace: (colorSpace) => {
            // Output only (renderer.outputColorSpace + clear color); texture formats are per texture.
            const viewer = useViewerStore.getState();
            viewer.setDisplayColorSpace(colorSpace);
            if (viewer.framework) {
                applyOutputColorSpace(viewer.framework, colorSpace);
            }
        },

        moveTexturesToFramework: (framework) => {
            const features = framework.graphicsDevice.features;
            const textures = get().textures.map((container) => {
                const colorSpace = textureColorSpace(container);
                const format = container.texture?.textureFormat
                    ?? (container.ktxContainer ? TextureFormat.UNDEFINED : rgba8Format(colorSpace));
                const wantsMipmaps = (container.texture?.mipLevels ?? 1) > 1;
                // Keep the format and mipmaps where the new backend supports them, otherwise fall back like a first load:
                // KTX2 lets the framework pick (Basis: best supported format; others: the file's format), images use RGBA8.
                const fallbackFormat = container.ktxContainer ? TextureFormat.UNDEFINED : rgba8Format(colorSpace);
                const formatUsable = features.supportsTextureFormat(format)
                    && !(isPvrtcFormat(format) && container.ktxContainer?.isArray);
                const attempts: Array<[TextureFormat, boolean]> = [];
                if (formatUsable) {
                    attempts.push([format, wantsMipmaps && mipmapsAllowed(container, format)]);
                    if (wantsMipmaps) {
                        attempts.push([format, false]);
                    }
                }
                attempts.push([fallbackFormat, false]);
                let texture: ViewerTexture | null = null;
                let lastError: unknown = null;
                for (const [textureFormat, generateMipmaps] of attempts) {
                    try {
                        texture = recreateTexture(framework, container, textureFormat, generateMipmaps, colorSpace);
                        break;
                    } catch (err) {
                        lastError = err;
                    }
                }
                if (!texture && lastError) {
                    console.error(`Failed to re-upload ${container.name} to the new canvas:`, lastError);
                } else if (texture && texture.textureFormat !== format) {
                    console.info(`${container.name}: ${format} isn't available on this backend, using ${texture.textureFormat}.`);
                }
                try {
                    container.texture?.dispose();
                } catch {
                    // The old context / device may already be gone.
                }
                return {...container, texture};
            });
            const selected = textures.find((item) => item.id === get().selectedId);
            const levels = Math.max(selected?.texture?.mipLevels ?? 1, 1);
            set((state) => ({textures, mipLevel: state.mipLevel >= levels ? 0 : state.mipLevel}));
        },

        setGenerateMipmaps: (value) => {
            const framework = useViewerStore.getState().framework;
            const selected = selectSelectedTexture(get());
            if (!framework || !selected) {
                return;
            }

            const textureFormat = selected.texture?.textureFormat ?? TextureFormat.RGBA8_UNORM;
            const texture = recreateTexture(
                framework,
                selected,
                textureFormat,
                value && mipmapsAllowed(selected, textureFormat),
                textureColorSpace(selected),
            );
            replaceTexture(selected, texture);
        },

        setMipLevel: (mipLevel) => set({mipLevel}),

        setLayer: (layer) => {
            const layers = arrayLayerCount(selectSelectedTexture(get()));
            set({layer: Math.min(Math.max(0, Math.trunc(layer)), Math.max(layers - 1, 0))});
        },
    };
});

/** The selected texture container, or null. */
export const useSelectedTexture = () => useTextureStore(selectSelectedTexture);

/** Every selected texture in list order (the multi-selection). */
export const useSelectedTextures = () => useTextureStore(useShallow(selectSelectedTextures));

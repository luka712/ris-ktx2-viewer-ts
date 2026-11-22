import type {ColorSpace, ITexture2D, ITexture2DArray, RawImageData} from "ris-framework";
import type {FrameworkKtx2Texture} from "./FrameworkKtx2.ts";

/** GPU texture of a list entry: a 2D texture, or a 2D texture array for KTX2 array files. */
export type ViewerTexture = ITexture2D | ITexture2DArray;

/** True for a 2D texture array (its `size` is [width, height, layers]). */
export function isTextureArray(texture: ViewerTexture | null | undefined): texture is ITexture2DArray {
    return texture != null && texture.size.length === 3;
}

export interface ITexture2DContainer {
    /** Stable id assigned when the texture is added (selection, list keys). */
    id: string;
    name: string;
    texture: ViewerTexture | null;
    /** KTX2 file (null for decoded images). `isArray` / `numLayers` tell whether it is a 2D texture array. */
    ktxContainer: FrameworkKtx2Texture | null;
    image: RawImageData | null;
    /** Byte size of the source file (picked/dropped file or encoded KTX2 output). Unknown if absent. */
    fileSize?: number;
    /**
     * The texture's own sRGB / linear choice (Inspector Texture Format picker), kept on every re-upload (backend
     * switch, mipmaps). Unset = the default: sRGB for images, the file's own color space for KTX2
     * (see textureColorSpace in TextureStore).
     */
    textureColorSpace?: ColorSpace;
}

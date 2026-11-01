import type {ITexture2D, RawImageData} from "ris-framework";
import type {FrameworkKtx2Texture} from "./FrameworkKtx2.ts";

export interface ITexture2DContainer {
    /** Stable id assigned when the texture is added (selection, list keys). */
    id: string;
    name: string;
    texture: ITexture2D | null;
    ktxContainer: FrameworkKtx2Texture | null;
    image: RawImageData | null;
    /** Byte size of the source file (picked/dropped file or encoded KTX2 output). Unknown if absent. */
    fileSize?: number;
}

import type {ITexture2D, RawImageData} from "ris-framework";
import type {IKtx2Texture} from "ris-ktx2";

export interface ITexture2DContainer {
    /** Stable id assigned when the texture is added (selection, list keys). */
    id: string;
    name: string;
    texture: ITexture2D | null;
    ktxContainer: IKtx2Texture | null;
    image: RawImageData | null;
}

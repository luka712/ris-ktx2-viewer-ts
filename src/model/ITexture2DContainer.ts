import type {ITexture2D, RawImageData} from "ris-framework-api";
import type {IKtx2Texture} from "ris-ktx2-api";

export interface ITexture2DContainer {
    name: string;
    texture: ITexture2D | null;
    ktxContainer: IKtx2Texture | null;
    image: RawImageData | null;
}

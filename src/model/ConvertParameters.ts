import {KTX_MEDIUM_QUALITY} from "./CompressionQualityConstants.ts";
import {RDO_BALANCED} from "./RDOCompressionConstants.ts";

export class ConvertParameters {
    public fileName = "";
    public encoding = "";
    public uastcQuality = KTX_MEDIUM_QUALITY;
    public etc1sQuality = KTX_MEDIUM_QUALITY;
    public rdoQuality = RDO_BALANCED;
    public generateMipmaps = false;
    public compression = "";
    public compressionLevelZLib = 0;
    public compressionLevelZstd = 0;
}
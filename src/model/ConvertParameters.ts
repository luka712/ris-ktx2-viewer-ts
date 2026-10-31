import {KTX_MEDIUM_QUALITY} from "./CompressionQualityConstants.ts";
import {RDO_BALANCED} from "./RDOCompressionConstants.ts";
import {DEFAULT_ASTC_BLOCK_SIZE, DEFAULT_ASTC_MODE, DEFAULT_ASTC_QUALITY} from "./AstcConstants.ts";

export class ConvertParameters {
    public fileName = "";
    public encoding = "";
    public blockAlign = true;
    public uastcQuality = KTX_MEDIUM_QUALITY;
    public etc1sQuality = KTX_MEDIUM_QUALITY;
    public rdoQuality = RDO_BALANCED;
    public generateMipmaps = false;
    public compression = "";
    public compressionLevelZLib = 0;
    public compressionLevelZstd = 0;
    public threadCount = -1;
    /** ASTC block size label, see ASTC_BLOCK_SIZE_OPTIONS. */
    public astcBlockSize = DEFAULT_ASTC_BLOCK_SIZE;
    /** AstcQualityLevel value (string enum). */
    public astcQuality = DEFAULT_ASTC_QUALITY;
    /** KtxAstcEncoderMode name. */
    public astcMode = DEFAULT_ASTC_MODE;
    public astcNormalMap = false;
    /**
     * Mark the output as sRGB color data (R8G8B8A8_SRGB source; libktx carries it to the Basis DFD
     * transfer function and to the ASTC_*_SRGB_BLOCK format). Off for linear data such as normal maps.
     */
    public srgb = true;
}
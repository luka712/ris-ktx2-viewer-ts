// ASTC encode options (labels shared by the Convert dialog, the worker and the main-thread encoder).
// Plain strings so ConvertParameters stays structured-cloneable; mapped to ris-ktx2 enums in Ktx2Encoder.

/** 2D block sizes supported by KtxAstcBlockDimension, from best quality / largest file to smallest. */
export const ASTC_BLOCK_SIZE_OPTIONS = ["4x4", "5x4", "5x5", "6x5", "6x6", "8x5", "8x6", "8x8",
    "10x5", "10x6", "10x8", "10x10", "12x10", "12x12"];
/** KtxAstcQualityLevel values. */
export const ASTC_QUALITY_OPTIONS = ["FASTEST", "FAST", "MEDIUM", "THOROUGH", "EXHAUSTIVE"];
/** KtxAstcEncoderMode names. HDR is left out: the source is always 8-bit RGBA. */
export const ASTC_MODE_OPTIONS = ["DEFAULT", "LDR"];

export const DEFAULT_ASTC_BLOCK_SIZE = "4x4";
export const DEFAULT_ASTC_QUALITY = "MEDIUM";
export const DEFAULT_ASTC_MODE = "DEFAULT";

export const ASTC_BLOCK_SIZE_TOOLTIP = "ASTC block footprint. Every block uses 128 bits, so larger blocks give smaller files (4x4 = 8 bpp, 8x8 = 2 bpp, 12x12 ≈ 0.89 bpp) at lower quality. The viewer can currently display 4x4 only.";
export const ASTC_QUALITY_TOOLTIP = "ASTC encoder search effort. Higher levels give better quality but take much longer to encode.";
export const ASTC_MODE_TOOLTIP = "ASTC encoder profile. DEFAULT lets the encoder decide; LDR forces the low dynamic range profile.";
export const ASTC_NORMAL_MAP_TOOLTIP = "Tune the encoder for tangent-space normal maps (X and Y in two channels). Use only for normal maps.";

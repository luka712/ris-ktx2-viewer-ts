// Option lists and help texts for the Convert To Ktx2 dialog.

import {
    KTX_ENCODING_ASTC,
    KTX_ENCODING_BASIS_UNIVERSAL_ETC1S,
    KTX_ENCODING_BASIS_UNIVERSAL_UASTC,
    KTX_ENCODING_RGBA
} from "./Ktx2EncodingConstants.ts";
import {
    KTX_HIGH_QUALITY,
    KTX_HIGHEST_QUALITY,
    KTX_LOW_QUALITY,
    KTX_LOWEST_QUALITY,
    KTX_MEDIUM_QUALITY
} from "./CompressionQualityConstants.ts";
import {
    KTX_COMPRESSION_NONE,
    KTX_COMPRESSION_ZLIB,
    KTX_COMPRESSION_ZSTANDARD
} from "./Ktx2CompressionConstants.ts";
import {
    RDO_BALANCED,
    RDO_HIGH_QUALITY,
    RDO_HIGHEST_QUALITY,
    RDO_SMALLER_FILE,
    RDO_SMALLEST_FILE,
} from "./RDOCompressionConstants.ts";

/** Encode select options; values stay the KTX_ENCODING_* names, only RGBA gets a clearer label. */
export const ENCODING_OPTIONS = [{value: KTX_ENCODING_RGBA, label: "Uncompressed (RGBA8)"}, {value: KTX_ENCODING_BASIS_UNIVERSAL_UASTC, label: "Basis UASTC (higher quality)"},
    {value: KTX_ENCODING_BASIS_UNIVERSAL_ETC1S, label: "Basis ETC1S (smaller)"},
    KTX_ENCODING_ASTC];
export const QUALITY_OPTIONS = [KTX_LOWEST_QUALITY, KTX_LOW_QUALITY, KTX_MEDIUM_QUALITY, KTX_HIGH_QUALITY, KTX_HIGHEST_QUALITY];
/** Extra (lossless) compression options; values stay the KTX_COMPRESSION_* names. */
export const COMPRESSION_OPTIONS = [
    {value: KTX_COMPRESSION_NONE, label: "None"},
    {value: KTX_COMPRESSION_ZSTANDARD, label: "Zstd"},
    {value: KTX_COMPRESSION_ZLIB, label: "ZLib"},
];

export const DEFAULT_COMPRESSION_LEVEL_ZSTD = 19;
export const DEFAULT_COMPRESSION_LEVEL_ZLIB = 6;

export const FILE_NAME_TOOLTIP = "Name of the output KTX2 file saved after conversion.";

export const ENCODING_TOOLTIP = "Encode the texture with the specified codec before saving it.";
export const ENCODING_VALUE_TOOLTIPS: Record<string, string> = {
    [KTX_ENCODING_BASIS_UNIVERSAL_UASTC]: "Encode the texture using UASTC, providing high-quality GPU texture compression.",
    [KTX_ENCODING_BASIS_UNIVERSAL_ETC1S]: "Encode the texture using ETC1S, providing smaller files at the cost of image quality.",
    [KTX_ENCODING_ASTC]: "Encode the texture directly as ASTC (no Basis transcoding). Needs GPU ASTC support to display; the viewer currently displays 4×4 only.",
    [KTX_ENCODING_RGBA]: "Store the texture uncompressed (8-bit RGBA). Largest files and GPU memory, no quality loss.",
};

export const SRGB_TOOLTIP = "Mark the texture as sRGB color data, so the GPU converts it to linear when sampling. Use it for color/albedo images; turn it off for linear data such as normal maps, roughness, masks or height maps.";

export const BLOCK_ALIGN_TOOLTIP = "Pad the image so width and height are multiples of the format's block size (4×4 for Basis ETC1S/UASTC, the chosen block size for ASTC, e.g. 6×6)."

export const MIPMAPS_TOOLTIP = "Stores smaller versions of the texture for use when displayed at reduced sizes. Mipmaps can improve visual quality and reduce texture sampling artifacts.";

export const UASTC_QUALITY_TOOLTIP = "Controls UASTC encoding quality versus encode time. Higher quality produces better image fidelity but takes longer to encode.";
export const ETC1S_QUALITY_TOOLTIP = "Controls ETC1S image quality versus file size. Higher quality preserves more detail but produces larger files and takes longer to encode.";

export const COMPRESSION_TOOLTIP = "Reduces file size only, not GPU memory: lossless supercompression applied after encoding and undone on load. Unavailable for ETC1S, which already uses its own built-in compression.";
export const COMPRESSION_VALUE_TOOLTIPS: Record<string, string> = {
    [KTX_COMPRESSION_NONE]: "Store the encoded texture without additional lossless compression.",
    [KTX_COMPRESSION_ZSTANDARD]: "Zstandard: lossless for smaller files. Generally preferred over ZLib. Reduces file size only, not GPU memory.",
    [KTX_COMPRESSION_ZLIB]: "ZLib: lossless, for smaller files. Reduces file size only, not GPU memory.",
};

export const COMPRESSION_LEVEL_ZSTD_TOOLTIP = "Higher levels produce smaller files but take longer and use more memory. Range is 1–22; values above 20 need substantially more memory.";
export const COMPRESSION_LEVEL_ZLIB_TOOLTIP = "Higher levels produce smaller files but take longer to compress. Range is 1–9.";

export const RDO_QUALITY_TOOLTIP = "Rate-Distortion Optimization conditions UASTC data so lossless compression packs it more tightly. Prefer higher quality for less visual change, or smaller file for stronger size reduction.";
export const RDO_VALUE_TOOLTIPS: Record<string, string> = {
    [RDO_SMALLEST_FILE]: "Strongest size reduction; more visible quality loss after lossless compression.",
    [RDO_SMALLER_FILE]: "Favors a smaller file with a moderate quality trade-off.",
    [RDO_BALANCED]: "Balanced trade-off between visual quality and compressed file size.",
    [RDO_HIGH_QUALITY]: "Preserves more image quality; produces a larger compressed file.",
    [RDO_HIGHEST_QUALITY]: "Least aggressive RDO; closest to the original UASTC quality with a larger file.",
};

// Option lists and help texts for the Convert To Ktx2 dialog.

import {
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

export const ENCODING_OPTIONS = [KTX_ENCODING_RGBA, KTX_ENCODING_BASIS_UNIVERSAL_UASTC, KTX_ENCODING_BASIS_UNIVERSAL_ETC1S];
export const QUALITY_OPTIONS = [KTX_LOWEST_QUALITY, KTX_LOW_QUALITY, KTX_MEDIUM_QUALITY, KTX_HIGH_QUALITY, KTX_HIGHEST_QUALITY];
export const COMPRESSION_OPTIONS = [KTX_COMPRESSION_NONE, KTX_COMPRESSION_ZSTANDARD, KTX_COMPRESSION_ZLIB];

export const DEFAULT_COMPRESSION_LEVEL_ZSTD = 19;
export const DEFAULT_COMPRESSION_LEVEL_ZLIB = 6;

export const FILE_NAME_TOOLTIP = "Name of the output KTX2 file saved after conversion.";

export const ENCODING_TOOLTIP = "Encode the texture with the specified codec before saving it.";
export const ENCODING_VALUE_TOOLTIPS: Record<string, string> = {
    [KTX_ENCODING_BASIS_UNIVERSAL_UASTC]: "Encode the texture using UASTC, providing high-quality GPU texture compression.",
    [KTX_ENCODING_BASIS_UNIVERSAL_ETC1S]: "Encode the texture using ETC1S, providing smaller files at the cost of image quality.",
    [KTX_ENCODING_RGBA]: "Store the texture as uncompressed raw RGBA data without texture encoding.",
};

export const BLOCK_ALIGN_TOOLTIP = "Align image dimensions to block size of compressed texture format."

export const MIPMAPS_TOOLTIP = "Generates smaller versions of the texture for use when displayed at reduced sizes. Mipmaps can improve visual quality and reduce texture sampling artifacts.";

export const UASTC_QUALITY_TOOLTIP = "Controls UASTC encoding quality versus encode time. Higher quality produces better image fidelity but takes longer to encode.";
export const ETC1S_QUALITY_TOOLTIP = "Controls ETC1S image quality versus file size. Higher quality preserves more detail but produces larger files and takes longer to encode.";

export const COMPRESSION_TOOLTIP = "Applies lossless supercompression to reduce file size after encoding. Unavailable for ETC1S, which already uses its own built-in compression.";
export const COMPRESSION_VALUE_TOOLTIPS: Record<string, string> = {
    [KTX_COMPRESSION_NONE]: "Store the encoded texture without additional lossless compression.",
    [KTX_COMPRESSION_ZSTANDARD]: "Apply Zstandard lossless supercompression for smaller files. Generally preferred over ZLib.",
    [KTX_COMPRESSION_ZLIB]: "Apply ZLib lossless supercompression for smaller files.",
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

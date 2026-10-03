import {TextureFormat} from "ris-framework-api";

const TEXTURE_FORMAT_LABELS: Partial<Record<TextureFormat, string>> = {
    [TextureFormat.UNDEFINED]: "UNDEFINED",
    [TextureFormat.RGBA_8_UNORM]: "RGBA_8_UNORM",
    [TextureFormat.DEPTH_24_STENCIL_8]: "DEPTH_24_STENCIL_8",
    [TextureFormat.DEPTH_32_FLOAT]: "DEPTH_32_FLOAT",
    [TextureFormat.RED_32_FLOAT]: "RED_32_FLOAT",
    [TextureFormat.RED_32_TYPELESS]: "RED_32_TYPELESS",
    [TextureFormat.BC7_RGBA_UNORM]: "BC7_RGBA_UNORM",
    [TextureFormat.BC3_RGBA_UNORM]: "BC3_RGBA_UNORM",
    [TextureFormat.ETC2_RGBA8_UNORM]: "ETC2_RGBA8_UNORM",
    [TextureFormat.ASTC_4X4_RGBA]: "ASTC_4X4_RGBA",
};

export function textureFormatToString(format: TextureFormat | undefined | null): string {
    if (format == null) {
        return "Unknown";
    }

    return TEXTURE_FORMAT_LABELS[format] ?? String(format);
}

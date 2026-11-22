import {TextureFormat} from "ris-framework";

/**
 * Display names that differ from the TextureFormat value. Since ris-framework 0.4 the enum values are the
 * wgpu-style names (e.g. "RGBA8_UNORM"), which are shown as-is.
 */
const TEXTURE_FORMAT_LABELS: Partial<Record<TextureFormat, string>> = {
    [TextureFormat.PVRTC1_RGBA_4BPP_UNORM]: "PVRTC1_4BPP_RGBA",
    [TextureFormat.PVRTC1_RGB_4BPP_UNORM]: "PVRTC1_4BPP_RGB",
};

export function textureFormatToString(format: TextureFormat | undefined | null): string {
    if (format == null) {
        return "Unknown";
    }

    return TEXTURE_FORMAT_LABELS[format] ?? String(format);
}

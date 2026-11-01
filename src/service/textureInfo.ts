// Display strings for the selected texture (inspector, status bar, texture list). DOM-free.

import {VkFormat} from "ris-ktx2";
import {describeAstcFormat} from "./astcFormats.ts";
import type {ITexture2DContainer} from "../model/ITexture2DContainer.ts";

/** "—" placeholder for values that are unknown or not applicable. */
export const NO_VALUE = "—";

const SRGB_LABEL = "sRGB (color)";
const LINEAR_LABEL = "Linear (data)";

const UNCOMPRESSED_FORMATS = new Set<number>([VkFormat.R8G8B8A8_UNORM, VkFormat.R8G8B8A8_SRGB]);

/**
 * KTX2 format label: "Uncompressed (RGBA8)" (or "Uncompressed" when `short`) for raw RGBA8, VkFormat name, or "Basis Universal" for transcodable data.
 * Plain images report their file type.
 */
export function encodingLabel(container: ITexture2DContainer | null | undefined, short = false): string {
    if (!container) {
        return NO_VALUE;
    }
    const ktx = container.ktxContainer;
    if (!ktx) {
        const extension = container.name.split(".").pop()?.toUpperCase();
        return extension ? `${extension} image` : "Image";
    }
    if (ktx.vkFormat === VkFormat.UNDEFINED) {
        // TODO: Tell ETC1S from UASTC once the framework's ris-ktx2 exposes the supercompression scheme.
        return ktx.needsTranscoding ? (short ? "Basis" : "Basis Universal") : NO_VALUE;
    }
    if (UNCOMPRESSED_FORMATS.has(ktx.vkFormat)) {
        return short ? "Uncompressed" : "Uncompressed (RGBA8)";
    }
    const astc = describeAstcFormat(ktx.vkFormat);
    if (astc) {
        // "6x6 SRGB" -> "ASTC 6×6"
        return `ASTC ${astc.label.split(" ")[0].replace("x", "×")}`;
    }
    return VkFormat[ktx.vkFormat] ?? `Unknown (${ktx.vkFormat})`;
}

/**
 * sRGB / Linear from the VkFormat name. Basis data reports UNDEFINED and the framework's ris-ktx2 0.1
 * does not expose the DFD transfer function, so it shows "—". Decoded images are sRGB by convention.
 */
/** Color space stored in the file (not how it is displayed; see displayColorSpace). */
export function colorSpaceLabel(container: ITexture2DContainer | null | undefined): string {
    if (!container) {
        return NO_VALUE;
    }
    const ktx = container.ktxContainer;
    if (!ktx) {
        return SRGB_LABEL;
    }
    if (ktx.vkFormat === VkFormat.UNDEFINED) {
        // TODO: Show sRGB/Linear for Basis textures once the DFD transfer function is exposed.
        return NO_VALUE;
    }
    return (VkFormat[ktx.vkFormat] ?? "").includes("SRGB") ? SRGB_LABEL : LINEAR_LABEL;
}

// ASTC VkFormat helpers. DOM-free and dependency-free.

/** 2D ASTC block sizes in VkFormat order (each has a UNORM and an SRGB value, starting at 157). */
const VK_ASTC_BLOCKS = ["4x4", "5x4", "5x5", "6x5", "6x6", "8x5", "8x6", "8x8",
    "10x5", "10x6", "10x8", "10x10", "12x10", "12x12"];
const VK_ASTC_4X4_UNORM_BLOCK = 157;
const VK_ASTC_4X4_SFLOAT_BLOCK = 1000066000;

export interface AstcFormatInfo {
    /** e.g. "6x6 SRGB". */
    label: string;
    /** ris-framework 0.1 can upload only ASTC_4X4_UNORM_BLOCK. */
    frameworkSupported: boolean;
}

/** Block size and variant for an ASTC VkFormat, or null for any other format. */
export function describeAstcFormat(vkFormat: number): AstcFormatInfo | null {
    const ldrIndex = vkFormat - VK_ASTC_4X4_UNORM_BLOCK;
    if (ldrIndex >= 0 && ldrIndex < VK_ASTC_BLOCKS.length * 2) {
        const srgb = ldrIndex % 2 === 1;
        const block = VK_ASTC_BLOCKS[Math.floor(ldrIndex / 2)];
        return {label: `${block} ${srgb ? "SRGB" : "UNORM"}`, frameworkSupported: ldrIndex === 0};
    }
    const hdrIndex = vkFormat - VK_ASTC_4X4_SFLOAT_BLOCK;
    if (hdrIndex >= 0 && hdrIndex < VK_ASTC_BLOCKS.length) {
        return {label: `${VK_ASTC_BLOCKS[hdrIndex]} SFLOAT`, frameworkSupported: false};
    }
    return null;
}

/** Parses a 2D block size label such as "6x5" (width x height). Throws on anything else. */
export function parseAstcBlockSize(label: string): { width: number; height: number } {
    const match = /^(\d+)x(\d+)$/.exec(label);
    if (!match) {
        throw new Error(`Unsupported ASTC block size: ${label}`);
    }
    return {width: Number(match[1]), height: Number(match[2])};
}

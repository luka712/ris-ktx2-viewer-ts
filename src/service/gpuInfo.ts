import {type IFramework, GpuBackend, TextureFormat} from "ris-framework";

/** Subset of `graphicsDevice.features` the GPU info needs (keeps this testable without a GPU). */
export interface GpuFeatureSource {
    supportsTextureCompressionS3TC: boolean;
    supportsTextureCompressionBC: boolean;
    supportsTextureCompressionETC2: boolean;
    supportsTextureCompressionASTC: boolean;
    supportsTextureCompressionPVRTC: boolean;
    supportsTextureFormat(format: TextureFormat): boolean;
}

/** A compressed format family shown in GPU info. */
interface FormatFamily {
    id: string;
    name: string;
    /** Extension / alternative name, shown secondary. */
    alias: string;
    flag: keyof Omit<GpuFeatureSource, "supportsTextureFormat">;
    /** Linear formats of the family the framework knows (`TextureFormat`). */
    formats: TextureFormat[];
    /** sRGB variants, empty when the family has none. */
    srgbFormats: TextureFormat[];
    /** What the family enables in the viewer. */
    hint: string;
}

const ASTC_BLOCKS = ["4X4", "5X4", "5X5", "6X5", "6X6", "8X5", "8X6", "8X8", "10X5", "10X6", "10X8", "10X10", "12X10", "12X12"];
const astc = (suffix: string) => ASTC_BLOCKS.map((block) => `ASTC_${block}_UNORM${suffix}` as TextureFormat);

export const FORMAT_FAMILIES: readonly FormatFamily[] = [
    {
        id: "s3tc", name: "BC1–BC3", alias: "S3TC / DXT", flag: "supportsTextureCompressionS3TC",
        formats: [TextureFormat.BC1_RGB_UNORM, TextureFormat.BC3_RGBA_UNORM],
        srgbFormats: [TextureFormat.BC1_RGB_UNORM_SRGB, TextureFormat.BC3_RGBA_UNORM_SRGB],
        hint: "Basis → BC3",
    },
    {
        id: "bptc", name: "BC6H / BC7", alias: "BPTC", flag: "supportsTextureCompressionBC",
        formats: [TextureFormat.BC7_RGBA_UNORM],
        srgbFormats: [TextureFormat.BC7_RGBA_UNORM_SRGB],
        hint: "Basis → BC7",
    },
    {
        id: "etc2", name: "ETC2", alias: "ETC2 / EAC", flag: "supportsTextureCompressionETC2",
        formats: [TextureFormat.ETC2_RGB8_UNORM, TextureFormat.ETC2_RGBA8_UNORM],
        srgbFormats: [TextureFormat.ETC2_RGB8_UNORM_SRGB, TextureFormat.ETC2_RGBA8_UNORM_SRGB],
        hint: "Basis → ETC2 RGBA8",
    },
    {
        id: "astc", name: "ASTC", alias: "LDR", flag: "supportsTextureCompressionASTC",
        formats: astc(""),
        srgbFormats: astc("_SRGB"),
        hint: "Basis → ASTC 4×4, ASTC KTX2 files",
    },
    {
        id: "pvrtc", name: "PVRTC1", alias: "PowerVR", flag: "supportsTextureCompressionPVRTC",
        formats: [TextureFormat.PVRTC1_RGBA_4BPP_UNORM, TextureFormat.PVRTC1_RGB_4BPP_UNORM,
            TextureFormat.PVRTC1_RGBA_2BPP_UNORM, TextureFormat.PVRTC1_RGB_2BPP_UNORM],
        srgbFormats: [],
        hint: "Basis → PVRTC1 4bpp (square power-of-two)",
    },
];

export interface FormatFamilySupport {
    id: string;
    name: string;
    alias: string;
    hint: string;
    supported: boolean;
    /** Linear formats the GPU supports / known in the family. */
    formatCount: {supported: number; total: number};
    /** null when the family has no sRGB variants. */
    srgb: boolean | null;
}

function supports(features: GpuFeatureSource, format: TextureFormat): boolean {
    try {
        return features.supportsTextureFormat(format);
    } catch {
        return false;
    }
}

/** Per-family support: the extension flag, refined with `supportsTextureFormat` per format and sRGB variant. */
export function formatFamilySupport(features: GpuFeatureSource): FormatFamilySupport[] {
    return FORMAT_FAMILIES.map((family) => {
        const supported = Boolean(features[family.flag]);
        const supportedFormats = supported ? family.formats.filter((format) => supports(features, format)).length : 0;
        return {
            id: family.id,
            name: family.name,
            alias: family.alias,
            hint: family.hint,
            supported,
            formatCount: {supported: supportedFormats, total: family.formats.length},
            srgb: family.srgbFormats.length === 0 ? null : supported && family.srgbFormats.some((format) => supports(features, format)),
        };
    });
}

export function backendLabel(api: GpuBackend): string {
    switch (api) {
        case GpuBackend.WEB_GL:
            return "WebGL2";
        case GpuBackend.WEB_GPU:
            return "WebGPU";
        default:
            return "Default";
    }
}

export interface GpuLimit {
    label: string;
    value: string;
}

/**
 * GPU limits from `graphicsDevice.limits` (`GpuLimits`), or null when the read throws
 * (the dialog stays up). See ai-guide/TODO-webgpu-framework.md #3.
 */
export function readGpuLimits(framework: IFramework): GpuLimit[] | null {
    try {
        const limits = framework.graphicsDevice.limits;
        return [
            {label: "Max 2D texture size", value: String(limits.maxTextureDimension2D)},
            {label: "Max 3D texture size", value: String(limits.maxTextureDimension3D)},
            {label: "Max texture array layers", value: String(limits.maxTextureArrayLayers)},
            {label: "Max uniform buffer binding size", value: `${limits.maxUniformBufferBindingSize} bytes`},
            {label: "Max anisotropy", value: String(limits.maximumAnisotropyLevel)},
        ];
    } catch {
        return null;
    }
}

export interface GpuSummary {
    name: string;
    vendor: string;
    backend: string;
    apiVersion: string;
    families: FormatFamilySupport[];
    limits: GpuLimit[] | null;
}

export function readGpuSummary(framework: IFramework): GpuSummary {
    const device = framework.graphicsDevice;
    return {
        name: device.gpuInfo.name || "Unknown GPU",
        vendor: device.gpuInfo.vendor || "Unknown vendor",
        backend: backendLabel(device.api),
        apiVersion: device.gpuInfo.apiVersion ?? "",
        families: formatFamilySupport(device.features),
        limits: readGpuLimits(framework),
    };
}

/** Plain-text summary for bug reports (GPU info "Copy" button). */
export function formatGpuSummary(summary: GpuSummary, userAgent?: string): string {
    const lines = [
        `GPU: ${summary.name}`,
        `Vendor: ${summary.vendor}`,
        `Backend: ${summary.backend}${summary.apiVersion ? ` (${summary.apiVersion})` : ""}`,
        "Compressed texture formats:",
        ...summary.families.map((family) => {
            const details = family.supported
                ? [`${family.formatCount.supported}/${family.formatCount.total} formats`,
                    ...(family.srgb === null ? [] : [`sRGB ${family.srgb ? "yes" : "no"}`])].join(", ")
                : "";
            return `  ${family.name} (${family.alias}): ${family.supported ? "supported" : "not supported"}${details ? ` (${details})` : ""}`;
        }),
    ];
    if (summary.limits) {
        lines.push("Limits:", ...summary.limits.map((limit) => `  ${limit.label}: ${limit.value}`));
    }
    if (userAgent) {
        lines.push(`User agent: ${userAgent}`);
    }
    return lines.join("\n");
}

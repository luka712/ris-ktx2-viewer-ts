import {ConvertParameters} from "../model/ConvertParameters.ts";
import {ENCODING_OPTIONS, QUALITY_OPTIONS, COMPRESSION_OPTIONS} from "../model/ConvertOptionsConstants.ts";
import {RDO_QUALITY_OPTIONS} from "../model/RDOCompressionConstants.ts";
import {ASTC_BLOCK_SIZE_OPTIONS, ASTC_MODE_OPTIONS, ASTC_QUALITY_OPTIONS} from "../model/AstcConstants.ts";

/** localStorage key for the last confirmed Convert dialog options (saved when Convert is pressed). */
export const CONVERT_OPTIONS_STORAGE_KEY = "ris-ktx2-viewer.convertOptions";

type Option = string | {value: string};
const values = (options: readonly Option[]) => options.map((o) => typeof o === "string" ? o : o.value);

/** Persisted fields with their validator. fileName and threadCount are per-texture/runtime and not stored. */
const VALIDATORS: Partial<Record<keyof ConvertParameters, (v: unknown) => boolean>> = {
    encoding: (v) => values(ENCODING_OPTIONS).includes(v as string),
    srgb: (v) => typeof v === "boolean",
    generateMipmaps: (v) => typeof v === "boolean",
    blockAlign: (v) => typeof v === "boolean",
    uastcQuality: (v) => QUALITY_OPTIONS.includes(v as string),
    etc1sQuality: (v) => QUALITY_OPTIONS.includes(v as string),
    rdoQuality: (v) => RDO_QUALITY_OPTIONS.includes(v as string),
    astcBlockSize: (v) => ASTC_BLOCK_SIZE_OPTIONS.includes(v as string),
    astcQuality: (v) => ASTC_QUALITY_OPTIONS.includes(v as string),
    astcMode: (v) => ASTC_MODE_OPTIONS.includes(v as string),
    astcNormalMap: (v) => typeof v === "boolean",
    compression: (v) => values(COMPRESSION_OPTIONS).includes(v as string),
    compressionLevelZstd: (v) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 22,
    compressionLevelZLib: (v) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 9,
};

/**
 * Overlays the saved options on `defaults`. Each field is validated on its own, so unknown,
 * out-of-range or no-longer-offered values (e.g. an option removed in a newer version) fall
 * back to the default while valid ones are kept. Corrupt JSON or unavailable storage → defaults.
 */
export function loadConvertOptions(defaults: ConvertParameters): ConvertParameters {
    const result = {...defaults};
    try {
        const raw = localStorage.getItem(CONVERT_OPTIONS_STORAGE_KEY);
        if (!raw) return result;
        const saved: unknown = JSON.parse(raw);
        if (!saved || typeof saved !== "object" || Array.isArray(saved)) return result;
        for (const [key, valid] of Object.entries(VALIDATORS)) {
            const value = (saved as Record<string, unknown>)[key];
            if (value !== undefined && valid!(value)) {
                (result as Record<string, unknown>)[key] = value;
            }
        }
        // Keep the libktx constraint: normal maps are linear.
        if (result.astcNormalMap) result.srgb = false;
    } catch {
        // Corrupt JSON or storage disabled: use defaults.
    }
    return result;
}

/** Saves the persistable options (see VALIDATORS). Errors (quota, privacy mode) are ignored. */
export function saveConvertOptions(params: ConvertParameters): void {
    try {
        const out: Record<string, unknown> = {};
        for (const key of Object.keys(VALIDATORS)) out[key] = params[key as keyof ConvertParameters];
        localStorage.setItem(CONVERT_OPTIONS_STORAGE_KEY, JSON.stringify(out));
    } catch {
        // ignore
    }
}

/** Removes the saved options. */
export function clearConvertOptions(): void {
    try { localStorage.removeItem(CONVERT_OPTIONS_STORAGE_KEY); } catch { /* ignore */ }
}

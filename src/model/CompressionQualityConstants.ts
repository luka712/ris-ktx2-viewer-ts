import {KtxUastcFlags} from "ris-ktx2-api";

export const KTX_LOWEST_QUALITY = "Lowest";
export const KTX_LOW_QUALITY = "Low";
export const KTX_MEDIUM_QUALITY = "Medium";
export const KTX_HIGH_QUALITY = "High";
export const KTX_HIGHEST_QUALITY = "Highest";

/**
 * Gets the compression level for the given compression quality
 * @param compressionQuality The compression quality.
 * @returns The compression level.
 */
export function getUastcEncodingFlags(compressionQuality: string): KtxUastcFlags {

    switch (compressionQuality) {
        case KTX_LOWEST_QUALITY:
            return KtxUastcFlags.LEVEL_FASTEST;
        case KTX_LOW_QUALITY:
            return KtxUastcFlags.LEVEL_FASTER;
        case KTX_MEDIUM_QUALITY:
            return KtxUastcFlags.LEVEL_DEFAULT;
        case KTX_HIGH_QUALITY:
            return KtxUastcFlags.LEVEL_SLOWER;
        case KTX_HIGHEST_QUALITY:
            return KtxUastcFlags.LEVEL_VERY_SLOW;
        default:
            throw new Error("Invalid compression quality");
    }
}

/**
 * Gets the quality level for ECT1S from a string.
 * @param quality The quality level string.
 * @returns The quality level.
 */
export function etECT1SQualityLevel(quality: string): number {
    switch (quality) {
        case KTX_LOWEST_QUALITY:
            return 32;
        case KTX_LOW_QUALITY:
            return 64;
        case KTX_MEDIUM_QUALITY:
            return 128;
        case KTX_HIGH_QUALITY:
            return 192;
        case KTX_HIGHEST_QUALITY:
            return 255;
        default:
            throw new Error("Invalid compression quality");
    }
}
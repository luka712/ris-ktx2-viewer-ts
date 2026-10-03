
export const RDO_HIGH_QUALITY = "High Quality";
export const RDO_HIGHEST_QUALITY = "Highest Quality";
export const RDO_BALANCED = "Balanced";
export const RDO_SMALLER_FILE = "Smaller File";
export const RDO_SMALLEST_FILE = "Smallest File";

export const RDO_QUALITY_OPTIONS = [
    RDO_SMALLEST_FILE,
    RDO_SMALLER_FILE,
    RDO_BALANCED,
    RDO_HIGH_QUALITY,
    RDO_HIGHEST_QUALITY,
];

/**
 * Gets the RDO quality scalar from a string UI label.
 * @param compression The compression UI label.
 * @returns The RDO quality scalar.
 */
export function getUastcRDOQualityScalar(compression: string): number {

    switch (compression) {
        case RDO_SMALLEST_FILE:
            return 4;
        case RDO_SMALLER_FILE:
            return 2;
        case RDO_BALANCED:
            return 1;
        case RDO_HIGH_QUALITY:
            return 0.5;
        case RDO_HIGHEST_QUALITY:
            return 0.2;
        default:
            throw new Error("Not implemented");
    }
};
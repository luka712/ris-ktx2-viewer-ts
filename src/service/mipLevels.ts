// Mip chain sizing. DOM-free and dependency-free (used by the converter, covered by tests/mipLevels.test.ts).

/**
 * Total number of mip levels, base level included, for a chain that halves both sides with
 * `Math.floor` (as ris-framework's `generateMipmapsAsync` does) and stops once the smaller side
 * is at or below `minSize`. Basis block formats use `minSize = 4`; raw RGBA uses 1, so the
 * smallest level is never 0 pixels wide or high.
 */
export function mipLevelCount(width: number, height: number, minSize: number): number {
    let size = Math.floor(Math.min(width, height));
    let levels = 1;
    while (size > minSize) {
        size = Math.floor(size / 2);
        levels++;
    }
    return levels;
}

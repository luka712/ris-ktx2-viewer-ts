// Rules for building one KTX2 2D texture array from several source images. DOM-free.

import type {ITexture2DContainer} from "../model/ITexture2DContainer.ts";
import {KTX2_FILE_EXTENSION} from "../model/FileExtensionConstants.ts";

/** Textures in list order whose source image can be converted (decoded images, not KTX2 files). */
export function convertibleSources(textures: readonly ITexture2DContainer[]): ITexture2DContainer[] {
    return textures.filter((texture) => texture.image !== null);
}

/**
 * Why `textures` can't become one texture array, or null when they can: at least two decoded images
 * (KTX2 files can't be layers) with identical width and height.
 */
export function arraySourceProblem(textures: readonly ITexture2DContainer[]): string | null {
    if (textures.length < 2) {
        return "Select at least two images.";
    }
    const ktx2 = textures.filter((texture) => !texture.image);
    if (ktx2.length > 0) {
        return ktx2.length === 1
            ? `${ktx2[0].name} is already a KTX2 file. Only PNG, JPEG or WebP images can be array layers.`
            : `${ktx2.length} of the selected textures are KTX2 files. Only PNG, JPEG or WebP images can be array layers.`;
    }
    const sizes = [...new Set(textures.map((texture) => `${texture.image!.baseWidth}×${texture.image!.baseHeight}`))];
    if (sizes.length > 1) {
        return `All images must have the same size (selected: ${sizes.join(", ")}).`;
    }
    return null;
}

/** Default output name for an array: "<first image name>_array.ktx2". */
export function arrayFileName(textures: readonly ITexture2DContainer[]): string {
    const name = textures[0]?.name ?? "texture";
    const extIndex = name.lastIndexOf(".");
    return `${extIndex > 0 ? name.slice(0, extIndex) : name}_array${KTX2_FILE_EXTENSION}`;
}

/** Moves the item at `from` one step up (-1) or down (+1). Returns a new array; out-of-range moves are no-ops. */
export function moveItem<T>(items: readonly T[], from: number, direction: -1 | 1): T[] {
    const to = from + direction;
    const next = [...items];
    if (from < 0 || from >= items.length || to < 0 || to >= items.length) {
        return next;
    }
    [next[from], next[to]] = [next[to], next[from]];
    return next;
}

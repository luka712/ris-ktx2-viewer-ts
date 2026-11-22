import {ColorSpace} from "ris-framework";

/** localStorage key for the Inspector's Display color space switch (sRGB | Linear). */
export const DISPLAY_COLOR_SPACE_STORAGE_KEY = "ris-ktx2-viewer.displayColorSpace";

/** sRGB is the default: the renderer encodes its output to sRGB (OutputColorSpace.SRGB). Linear = no conversion. */
export const DEFAULT_DISPLAY_COLOR_SPACE = ColorSpace.SRGB;

const VALID: readonly string[] = [ColorSpace.SRGB, ColorSpace.LINEAR];

/**
 * Saved display color space; the default (sRGB) when nothing is saved, the value is invalid (including the old
 * "FILE" option) or storage is unavailable.
 */
export function loadDisplayColorSpace(): ColorSpace {
    try {
        const saved = localStorage.getItem(DISPLAY_COLOR_SPACE_STORAGE_KEY);
        return saved !== null && VALID.includes(saved) ? saved as ColorSpace : DEFAULT_DISPLAY_COLOR_SPACE;
    } catch {
        return DEFAULT_DISPLAY_COLOR_SPACE;
    }
}

/** Saves the display color space; ignores unavailable storage (private mode, quota). */
export function saveDisplayColorSpace(colorSpace: ColorSpace) {
    try {
        localStorage.setItem(DISPLAY_COLOR_SPACE_STORAGE_KEY, colorSpace);
    } catch {
        // Not persisted; the switch still works for this session.
    }
}

import {Color, ColorSpace, type IFramework, OutputColorSpace} from "ris-framework";

/** Background gray as displayed on screen (both modes). */
const CLEAR_GRAY = 0.8;
const CLEAR_ALPHA = 0.5;

/**
 * Renderer output for the Display switch: sRGB → OutputColorSpace.SRGB (sampled sRGB textures are linear in the
 * shader and the framework encodes to sRGB on present); Linear → OutputColorSpace.NONE (no conversion anywhere,
 * so UNORM texture bytes, e.g. PNG data, pass straight through to the screen).
 */
export function outputColorSpaceFor(displayColorSpace: ColorSpace): OutputColorSpace {
    return displayColorSpace === ColorSpace.SRGB ? OutputColorSpace.SRGB : OutputColorSpace.NONE;
}

/**
 * Applies the Display switch to the renderer: output color space (ris-framework switches it live, the blit pipeline
 * encodes or passes through) and the clear color, given in linear space under sRGB output (gamma 2.2, the
 * framework's encode) so the background shows the same gray in both modes.
 */
export function applyOutputColorSpace(framework: IFramework, displayColorSpace: ColorSpace): void {
    const output = outputColorSpaceFor(displayColorSpace);
    framework.renderer.outputColorSpace = output;
    const gray = output === OutputColorSpace.SRGB ? Math.pow(CLEAR_GRAY, 2.2) : CLEAR_GRAY;
    framework.renderer.clearColor = new Color(gray, gray, gray, CLEAR_ALPHA);
}

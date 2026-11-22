// GPU texture creation for the texture store. Functions here create resources and leave
// disposing the previous ones to the caller, so a failed creation never leaves the store
// holding a disposed texture.
//
// Color space: each texture has its own sRGB / linear choice (ITexture2DContainer.textureColorSpace, picked in the
// Inspector's Texture Format list). It is passed explicitly as the texture format (sRGB or UNORM variant) and as
// the `colorSpace` override for KTX2. Defaults: images RGBA8 sRGB, KTX2 the file's own color space (fileColorSpace).
// The Display switch only sets renderer.outputColorSpace (service/outputColorSpace.ts), not texture formats.

import {
    ColorSpace,
    type IFramework,
    type ITexture2D,
    type ITexture2DArray,
    TextureFormat,
    TextureUtilities,
} from "ris-framework";
import {KtxDFTransfer, VkFormat} from "ris-ktx2";
import type {FrameworkKtx2Texture} from "../model/FrameworkKtx2.ts";
import {describeAstcFormat} from "./astcFormats.ts";
import type {ITexture2DContainer, ViewerTexture} from "../model/ITexture2DContainer.ts";
import {decodeImageAsync, isDecodableImage, isKtx2File} from "./textureUtilities.ts";

const UNCOMPRESSED_VK_FORMATS = new Set<number>([VkFormat.R8G8B8A8_UNORM, VkFormat.R8G8B8A8_SRGB]);

let nextTextureId = 0;

/** Unique id for a texture container (crypto.randomUUID is unavailable over plain-HTTP LAN dev). */
export function createTextureId(): string {
    nextTextureId++;
    return `texture-${nextTextureId}`;
}

/** The KTX2 file's own color space: DFD transfer function, else the vkFormat (…_SRGB), else linear. */
export function fileColorSpace(ktx: FrameworkKtx2Texture): ColorSpace {
    if (ktx.oetf === KtxDFTransfer.SRGB) {
        return ColorSpace.SRGB;
    }
    if (ktx.oetf === KtxDFTransfer.LINEAR) {
        return ColorSpace.LINEAR;
    }
    return (VkFormat[ktx.vkFormat] ?? "").includes("SRGB") ? ColorSpace.SRGB : ColorSpace.LINEAR;
}


/** RGBA8 in the given color space. */
export function rgba8Format(colorSpace: ColorSpace): TextureFormat {
    return colorSpace === ColorSpace.SRGB ? TextureFormat.RGBA8_UNORM_SRGB : TextureFormat.RGBA8_UNORM;
}

/** Array layers of a KTX2 texture: 0 when it is not a 2D texture array. */
export function ktx2LayerCount(ktx: FrameworkKtx2Texture | null | undefined): number {
    return ktx?.isArray ? Math.max(ktx.numLayers, 1) : 0;
}

/** The GPU's maximum 2D texture array layers, or null when the limits can't be read. */
export function maxTextureArrayLayers(framework: IFramework | null | undefined): number | null {
    try {
        const max = framework?.graphicsDevice.limits.maxTextureArrayLayers;
        return typeof max === "number" && max > 0 ? max : null;
    } catch {
        return null;
    }
}

/** Message when `layerCount` exceeds the GPU's array layer limit, otherwise null. */
export function arrayLayerLimitProblem(layerCount: number, maxLayers: number | null): string | null {
    if (maxLayers === null || layerCount <= maxLayers) {
        return null;
    }
    return `This texture array has ${layerCount} layers, but this GPU/backend supports at most ${maxLayers}.`;
}

/** Whether a format is PVRTC1 (WebGL only allows it on TEXTURE_2D; WebGPU has no PVRTC). */
export function isPvrtcFormat(format: TextureFormat): boolean {
    return String(format).startsWith("PVRTC");
}

/** Whether the format is RGBA8 (linear or sRGB), the only formats the framework generates mipmaps for. */
export function isRgba8Format(format: TextureFormat): boolean {
    return format === TextureFormat.RGBA8_UNORM || format === TextureFormat.RGBA8_UNORM_SRGB;
}

/**
 * Uploads a KTX2 texture as a 2D texture. Uploads from a copy, because the framework may
 * transcode the texture it is given and the original is kept for later format changes.
 * `textureFormat` UNDEFINED lets the framework pick (Basis: best GPU format; others: the file's format).
 */
export function createTextureFromKtx2(
    framework: IFramework,
    ktx: FrameworkKtx2Texture,
    textureFormat: TextureFormat,
    colorSpace: ColorSpace,
    generateMipmaps = false,
): ITexture2D {
    const copy = ktx.createCopy();
    try {
        assertAstcDisplayable(framework, copy.vkFormat);
        return framework.textureFactory.createFromKtx2(copy, textureFormat, colorSpace, generateMipmaps);
    } finally {
        copy.delete();
    }
}

/** Level-0 bytes for `ITextureDescriptor.data`. ImageLoader already decodes to raw pixels. */
function imageLevel0Data(data: number[] | ArrayBufferView): Uint8Array[] {
    if (data instanceof Uint8Array) {
        return [data];
    }
    if (ArrayBuffer.isView(data)) {
        return [new Uint8Array(data.buffer, data.byteOffset, data.byteLength)];
    }
    return [Uint8Array.from(data)];
}

/**
 * Uploads a KTX2 2D texture array once, every layer and mip level (2D: InspectTextureArrayMaterial,
 * 3D: UnlitTextureArrayMaterial). Compressed arrays upload as-is where the device supports the format (WebGL2 and
 * WebGPU); PVRTC arrays are not possible (see {@link prepareArrayUpload}). `generateMipmaps` applies to
 * single-level RGBA8 data only (the framework renders the chain).
 */
export function createTextureArrayFromKtx2(
    framework: IFramework,
    ktx: FrameworkKtx2Texture,
    textureFormat: TextureFormat,
    colorSpace: ColorSpace,
    generateMipmaps = false,
): ITexture2DArray {
    const prepared = prepareArrayUpload(framework, ktx, textureFormat, colorSpace);
    try {
        return framework.textureFactory.createTexture2DArrayFromKtx2(
            prepared.copy, ktx2LayerCount(prepared.copy), prepared.textureFormat, colorSpace, undefined,
            generateMipmaps && prepared.copy.numLevels <= 1 && isRgba8Format(prepared.textureFormat));
    } finally {
        prepared.copy.delete();
    }
}

/** The framework format for a KTX2 vkFormat, or null when the framework has no mapping (it throws then). */
function fileTextureFormat(vkFormat: number): TextureFormat | null {
    try {
        const format = TextureUtilities.convertVkFormatToTextureFormat(vkFormat);
        return format === TextureFormat.UNDEFINED ? null : format;
    } catch {
        return null;
    }
}

/** Basis transcode targets the framework would pick for UNDEFINED, minus PVRTC (not allowed for arrays). */
function hasNonPvrtcTranscodeTarget(framework: IFramework): boolean {
    const features = framework.graphicsDevice.features;
    return features.supportsTextureCompressionBC || features.supportsTextureCompressionASTC
        || features.supportsTextureCompressionS3TC || features.supportsTextureCompressionETC2;
}

/**
 * A copy of `ktx` the backend can upload as an array, and the texture format to request.
 * PVRTC can't be used for arrays (WebGL: TEXTURE_2D only; WebGPU: no PVRTC): an explicit PVRTC request throws,
 * and Basis data on a GPU whose only transcode target is PVRTC is transcoded to RGBA8 instead. ASTC needs GPU support.
 */
function prepareArrayUpload(
    framework: IFramework,
    ktx: FrameworkKtx2Texture,
    textureFormat: TextureFormat,
    colorSpace: ColorSpace,
): { copy: FrameworkKtx2Texture; textureFormat: TextureFormat } {
    const layerProblem = arrayLayerLimitProblem(ktx2LayerCount(ktx), maxTextureArrayLayers(framework));
    if (layerProblem) {
        throw new Error(`Can't display it: ${layerProblem} The KTX2 file itself is fine.`);
    }
    if (isPvrtcFormat(textureFormat)) {
        throw new Error(`Can't show a texture array as ${textureFormat}: PVRTC can only be used for 2D textures. `
            + "Pick another format.");
    }
    const copy = ktx.createCopy();
    try {
        if (copy.needsTranscoding && copy.vkFormat === VkFormat.UNDEFINED) {
            if (textureFormat === TextureFormat.UNDEFINED && !hasNonPvrtcTranscodeTarget(framework)) {
                return {copy, textureFormat: rgba8Format(colorSpace)};
            }
            return {copy, textureFormat};
        }
        assertAstcDisplayable(framework, copy.vkFormat);
        if (!UNCOMPRESSED_VK_FORMATS.has(copy.vkFormat)) {
            const fileFormat = fileTextureFormat(copy.vkFormat);
            if (fileFormat && !framework.graphicsDevice.features.supportsTextureFormat(fileFormat)) {
                throw new Error(`Can't display a ${VkFormat[copy.vkFormat] ?? copy.vkFormat} texture array: this GPU/backend `
                    + `doesn't support ${fileFormat}. The KTX2 file itself is fine.`);
            }
        }
        return {copy, textureFormat};
    } catch (err) {
        copy.delete();
        throw err;
    }
}

/**
 * ris-framework uploads non-Basis KTX2 data as-is (no transcoding) and maps LDR ASTC (UNORM/SRGB) to a GPU
 * format, using WebGL's WEBGL_compressed_texture_astc. Anything else would fail inside the framework with an
 * unclear error, so fail early with a clear message.
 */
function assertAstcDisplayable(framework: IFramework, vkFormat: number): void {
    const astc = describeAstcFormat(vkFormat);
    if (!astc) {
        return;
    }
    if (!framework.graphicsDevice.features.supportsTextureCompressionASTC) {
        throw new Error(`Can't display ASTC ${astc.label}: this GPU/browser does not support ASTC textures `
            + "(WEBGL_compressed_texture_astc). The KTX2 file itself is fine.");
    }
    if (!astc.frameworkSupported) {
        // TODO: ASTC HDR (SFLOAT) needs framework support.
        throw new Error(`Can't display ASTC ${astc.label}: the viewer can't display ASTC HDR (SFLOAT) yet. `
            + "The KTX2 file itself is fine.");
    }
}

/** First upload of a KTX2 texture: a texture array when the file is one, otherwise a 2D texture. */
export function createTextureForKtx2(framework: IFramework, ktx: FrameworkKtx2Texture, colorSpace: ColorSpace): ViewerTexture {
    return ktx.isArray
        ? createTextureArrayFromKtx2(framework, ktx, TextureFormat.UNDEFINED, colorSpace)
        : createTextureFromKtx2(framework, ktx, TextureFormat.UNDEFINED, colorSpace);
}

/** Decodes an image (RGBA8 sRGB) or KTX2 file (its own color space) and uploads it. Cleans up on failure. */
export async function loadTextureFromFileAsync(
    framework: IFramework,
    file: File,
): Promise<Omit<ITexture2DContainer, "id">> {
    if (isDecodableImage(file)) {
        const colorSpace = ColorSpace.SRGB;
        const image = await decodeImageAsync(framework, file);
        try {
            const texture = framework.textureFactory.create({
                width: image.baseWidth,
                height: image.baseHeight,
                data: imageLevel0Data(image.getData(0)),
                label: file.name,
                textureFormat: rgba8Format(colorSpace),
            });
            return {name: file.name, texture, image, ktxContainer: null, fileSize: file.size};
        } catch (err) {
            image.dispose();
            throw err;
        }
    }

    if (isKtx2File(file)) {
        if (!framework.ktx2Factory) {
            throw new Error("KTX2 support is not available");
        }
        const ktx = await framework.ktx2Factory.loadAsync(file);
        try {
            const texture = createTextureForKtx2(framework, ktx, fileColorSpace(ktx));
            return {name: file.name, texture, ktxContainer: ktx, image: null, fileSize: file.size};
        } catch (err) {
            ktx.delete();
            throw err;
        }
    }

    throw new Error(`Unsupported file type: ${file.name}`);
}

/**
 * Creates a new GPU texture for the container with the given format / mipmaps.
 * Does not dispose the container's current texture; the caller does that after success.
 */
export function recreateTexture(
    framework: IFramework,
    container: ITexture2DContainer,
    textureFormat: TextureFormat,
    generateMipmaps: boolean,
    colorSpace: ColorSpace,
): ViewerTexture | null {
    const ktx = container.ktxContainer;
    if (ktx) {
        // Always upload from a copy, to be able to change the texture format later.
        if (ktx.isArray) {
            return createTextureArrayFromKtx2(framework, ktx, textureFormat, colorSpace, generateMipmaps);
        }
        return createTextureFromKtx2(framework, ktx, textureFormat, colorSpace, generateMipmaps);
    }

    const image = container.image;
    if (image) {
        return framework.textureFactory.create({
            width: image.baseWidth,
            height: image.baseHeight,
            data: imageLevel0Data(image.getData(0)),
            label: container.name,
            textureFormat,
            generateMipmaps,
        });
    }

    return null;
}

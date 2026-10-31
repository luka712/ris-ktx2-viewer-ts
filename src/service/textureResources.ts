// GPU texture creation for the texture store. Functions here create resources and leave
// disposing the previous ones to the caller, so a failed creation never leaves the store
// holding a disposed texture.

import {type IFramework, type ITexture2D, TextureDescriptor, type TextureFormat, TextureUsage} from "ris-framework";
import type {FrameworkKtx2Texture} from "../model/FrameworkKtx2.ts";
import {describeAstcFormat} from "./astcFormats.ts";
import type {ITexture2DContainer} from "../model/ITexture2DContainer.ts";
import {decodeImageAsync, isDecodableImage, isKtx2File} from "./textureUtilities.ts";

const DEFAULT_USAGE = TextureUsage.TEXTURE_BINDING | TextureUsage.COPY_DST;

let nextTextureId = 0;

/** Unique id for a texture container (crypto.randomUUID is unavailable over plain-HTTP LAN dev). */
export function createTextureId(): string {
    nextTextureId++;
    return `texture-${nextTextureId}`;
}

/**
 * Uploads a KTX2 texture to the GPU. Uploads from a copy, because the framework may
 * transcode the texture it is given and the original is kept for later format changes.
 */
export function createTextureFromKtx2(
    framework: IFramework,
    ktx: FrameworkKtx2Texture,
    descriptor?: TextureDescriptor,
): ITexture2D {
    assertAstcDisplayable(framework, ktx.vkFormat);
    const copy = ktx.createCopy();
    try {
        return framework.textureFactory.createFromKtx2(copy, descriptor);
    } finally {
        copy.delete();
    }
}

/**
 * ris-framework uploads non-Basis KTX2 data as-is (no transcoding) and only maps ASTC 4×4 UNORM to a GPU
 * format, using WebGL's WEBGL_compressed_texture_astc. Anything else would fail inside the framework with an
 * unclear error, so fail early with a clear message.
 */
function assertAstcDisplayable(framework: IFramework, vkFormat: number): void {
    const astc = describeAstcFormat(vkFormat);
    if (!astc) {
        return;
    }
    if (!framework.graphicsDevice.features.supportsTextureCompressionASTC) {
        // TODO: Decode ASTC to RGBA8 for display (ris-ktx2 0.2 decodeAstc) on GPUs without ASTC support.
        throw new Error(`Can't display ASTC ${astc.label}: this GPU/browser does not support ASTC textures `
            + "(WEBGL_compressed_texture_astc). The KTX2 file itself is fine.");
    }
    if (!astc.frameworkSupported) {
        // TODO: ris-framework 0.1 maps only ASTC_4X4_UNORM_BLOCK; other block sizes / sRGB / HDR need framework support.
        throw new Error(`Can't display ASTC ${astc.label}: the viewer can only display ASTC 4x4 (UNORM) for now. `
            + "The KTX2 file itself is fine.");
    }
}

/** Decodes an image or KTX2 file and uploads it. Cleans up the KTX2 container on failure. */
export async function loadTextureFromFileAsync(
    framework: IFramework,
    file: File,
): Promise<Omit<ITexture2DContainer, "id">> {
    if (isDecodableImage(file)) {
        const image = await decodeImageAsync(framework, file);
        try {
            const texture = framework.textureFactory.create(
                image.baseWidth,
                image.baseHeight,
                image.getData(0),
                image.channels,
                file.name,
            );
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
            const texture = createTextureFromKtx2(framework, ktx);
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
): ITexture2D | null {
    if (container.ktxContainer) {
        const desc = new TextureDescriptor();
        desc.textureFormat = textureFormat;
        desc.generateMipmaps = generateMipmaps;
        // Always use a copy to be able to change texture format.
        return createTextureFromKtx2(framework, container.ktxContainer, desc);
    }

    const image = container.image;
    if (image) {
        return framework.textureFactory.create(
            image.baseWidth,
            image.baseHeight,
            image.getData(0),
            4,
            container.name,
            DEFAULT_USAGE,
            textureFormat,
            generateMipmaps,
        );
    }

    return null;
}

// GPU texture creation for the texture store. Functions here create resources and leave
// disposing the previous ones to the caller, so a failed creation never leaves the store
// holding a disposed texture.

import {type IFramework, type ITexture2D, TextureDescriptor, type TextureFormat, TextureUsage} from "ris-framework";
import type {IKtx2Texture} from "ris-ktx2";
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
    ktx: IKtx2Texture,
    descriptor?: TextureDescriptor,
): ITexture2D {
    const copy = ktx.createCopy();
    try {
        return framework.textureFactory.createFromKtx2(copy, descriptor);
    } finally {
        copy.delete();
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
            return {name: file.name, texture, image, ktxContainer: null};
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
            return {name: file.name, texture, ktxContainer: ktx, image: null};
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

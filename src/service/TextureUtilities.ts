import {type IFramework, RawImageData} from "ris-framework-api";

const IMAGE_MIME_TYPES = new Set([
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
]);

export function isDecodableImage(file: File): boolean {
    return IMAGE_MIME_TYPES.has(file.type);
}

export function isKtx2File(file: File): boolean {
    return file.name.toLowerCase().endsWith(".ktx2");
}

export async function decodeImageAsync(fw: IFramework, file: File): Promise<RawImageData> {
    const url = URL.createObjectURL(file);

    try {
        return await fw.imageLoader.loadAsync(url, false);
    } finally {
        URL.revokeObjectURL(url);
    }
}


export function downloadKtx2(
    data: ArrayBufferView<ArrayBufferLike>,
    filename = "texture.ktx2"
) {
    const blob = new Blob([data as BlobPart], {
        type: "image/ktx2"
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
}
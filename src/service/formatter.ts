import {KTX2_FILE_EXTENSION} from "../model/FileExtensionConstants.ts";

export function changeFileExtension(fileName: string, ext: string): string {

    const extIndex = fileName?.lastIndexOf('.') ?? 0;
    if(extIndex > 0) {
        const ext = fileName?.substring(extIndex) ?? "";
        fileName = fileName?.replace(ext, KTX2_FILE_EXTENSION) ?? "";
    }else {
        fileName = fileName + ext;
    }

    return fileName;

}

/**
 * Returns `name`, or the first free `base (n).ext` (n = 2, 3, …) if `isTaken(name)` is true.
 * Example: "brick.ktx2" → "brick (2).ktx2".
 */
export function makeUniqueName(name: string, isTaken: (candidate: string) => boolean): string {
    if (!isTaken(name)) {
        return name;
    }
    const extIndex = name.lastIndexOf(".");
    const base = extIndex > 0 ? name.slice(0, extIndex) : name;
    const ext = extIndex > 0 ? name.slice(extIndex) : "";
    for (let n = 2; ; n++) {
        const candidate = `${base} (${n})${ext}`;
        if (!isTaken(candidate)) {
            return candidate;
        }
    }
}

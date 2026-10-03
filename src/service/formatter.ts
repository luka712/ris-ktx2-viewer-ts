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
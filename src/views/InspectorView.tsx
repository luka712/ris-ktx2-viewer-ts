import {useState} from "react";
import {Alert, Box, Divider, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography} from "@mui/material";
import {ColorSpace, TextureFormat, TextureUtilities} from "ris-framework";
import {VkFormat} from "ris-ktx2";
import {SelectField, type SelectOption} from "../components/fields/SelectField.tsx";
import {CheckboxField} from "../components/fields/CheckboxField.tsx";
import {textureFormatToString} from "../service/mapper.ts";
import {colorSpaceLabel, encodingLabel, NO_VALUE} from "../service/textureInfo.ts";
import {
    canGenerateMipmaps,
    formatFileSize,
    textureDetails,
    useSelectedTexture,
    useTextureStore,
} from "../store/TextureStore.ts";
import {useViewerStore} from "../store/viewerStore.ts";

const FORMAT_TOOLTIP = "Specifies the GPU texture format used to display the texture. Compressed formats reduce memory usage, at the expense of quality.";
const MIPMAPS_TOOLTIP = "Generates mipmaps on the GPU at display time (they are not stored in the file). Smaller versions of the texture improve quality and reduce sampling artifacts when it is shown at reduced sizes.";

/**
 * GPU formats the selected texture can be displayed in: always RGBA8, plus the
 * compressed formats the GPU supports when the texture is Basis Universal (transcodable).
 */
/**
 * Formats the selected texture can be uploaded as, given its current format. Offers the sRGB variants when the
 * current format is sRGB (ris-framework 0.2 picks them for color data). Non-Basis KTX2 data is uploaded as-is,
 * so its only option is its current format.
 */
function useTextureFormatOptions(current: TextureFormat | undefined): SelectOption<TextureFormat>[] {
    const ktx = useSelectedTexture()?.ktxContainer;
    const framework = useViewerStore((state) => state.framework);
    const features = framework?.graphicsDevice.features;

    const isBasisCompressed = Boolean(ktx?.needsTranscoding) && ktx?.vkFormat === VkFormat.UNDEFINED;
    const srgb = current != null && TextureUtilities.isSrgbFormat(current);
    if (ktx && !isBasisCompressed && current != null) {
        return [{value: current, label: textureFormatToString(current)}];
    }
    const formats = [
        TextureFormat.RGBA_8_UNORM,
        ...(isBasisCompressed && features ? [
            features.supportsTextureCompressionBC && TextureFormat.BC7_RGBA_UNORM,
            features.supportsTextureCompressionASTC && TextureFormat.ASTC_4X4_RGBA_UNORM,
            features.supportsTextureCompressionS3TC && TextureFormat.BC3_RGBA_UNORM,
            features.supportsTextureCompressionETC2 && TextureFormat.ETC2_RGBA8_UNORM,
        ] : []),
    ].filter((format) => format !== false)
        .map((format) => srgb ? TextureUtilities.convertToSrgbVariant(format) : format);

    const options: SelectOption<TextureFormat>[] = formats.map((format) => ({value: format, label: textureFormatToString(format)}));

    // PVRTC1 (WEBGL_compressed_texture_pvrtc, mostly iOS/PowerVR): 4bpp RGBA and RGB, no sRGB variant, and it needs a
    // square power-of-two texture, so other sizes get a disabled entry with the reason.
    if (isBasisCompressed && features?.supportsTextureCompressionPVRTC && ktx) {
        const pot = isSquarePowerOfTwo(ktx.width, ktx.height);
        for (const [value, name] of [
            [TextureFormat.PVRTC_4BPPV1_RGBA, "PVRTC1_4BPP_RGBA"],
            [TextureFormat.PVRTC_4BPPV1_RGB, "PVRTC1_4BPP_RGB"],
        ] as const) {
            options.push({value, label: pot ? name : `${name} (needs square power-of-two size)`, disabled: !pot});
        }
    }
    return options;
}

function isSquarePowerOfTwo(width: number, height: number): boolean {
    return width === height && width > 0 && (width & (width - 1)) === 0;
}

function SectionTitle({children}: { children: string }) {
    return (
        <Typography variant="overline" color="text.secondary" sx={{px: 2, pt: 1.5, display: "block", lineHeight: 2}}>
            {children}
        </Typography>
    );
}

/** Name/value rows; the value wraps (long VkFormat names). */
function InfoRow({label, value}: { label: string; value: string | number }) {
    return (
        <Box sx={{display: "flex", justifyContent: "space-between", gap: 2, px: 2, py: 0.5}}>
            <Typography variant="body2" color="text.secondary" sx={{flexShrink: 0}}>{label}</Typography>
            <Typography variant="body2" sx={{textAlign: "right", wordBreak: "break-word"}}>{value}</Typography>
        </Box>
    );
}

/**
 * Right panel: Info (read-only details of the selected texture) and Display (GPU format, mipmaps).
 * View, filter and mip level live in the viewport toolbar.
 */
export function InspectorView() {
    const selectedTexture = useSelectedTexture();
    const texture = selectedTexture?.texture;
    const {textureFormat, generateMipmaps, resolution, size, mipLevels} = textureDetails(texture);
    const setTextureFormat = useTextureStore((store) => store.setTextureFormat);
    const setGenerateMipmaps = useTextureStore((store) => store.setGenerateMipmaps);
    const [textureError, setTextureError] = useState<string | null>(null);
    const formatOptions = useTextureFormatOptions(textureFormat);

    /** Recreating the GPU texture can fail (e.g. transcode); the store keeps the current texture then. */
    const displayColorSpace = useViewerStore((state) => state.displayColorSpace);
    const applyDisplayColorSpace = useTextureStore((state) => state.applyDisplayColorSpace);
    const recreate = (apply: () => void) => {
        try {
            apply();
            setTextureError(null);
        } catch (err) {
            console.error("Failed to recreate texture:", err);
            setTextureError(err instanceof Error ? err.message : String(err));
        }
    };

    if (!selectedTexture) {
        return (
            <Box sx={{p: 2}}>
                <Typography variant="body2" color="text.secondary">
                    Select or add a texture to see its details.
                </Typography>
            </Box>
        );
    }

    return (
        <Stack sx={{pb: 1}}>
            <Typography variant="subtitle2" sx={{px: 2, pt: 1.5, wordBreak: "break-all"}}>
                {selectedTexture.name}
            </Typography>

            <SectionTitle>Info</SectionTitle>
            <InfoRow label="Resolution" value={texture ? resolution : NO_VALUE}/>
            <InfoRow label="Mip levels" value={texture ? mipLevels : NO_VALUE}/>
            <InfoRow label="File size" value={formatFileSize(selectedTexture.fileSize)}/>
            <InfoRow label="GPU memory" value={texture ? size : NO_VALUE}/>
            <InfoRow label="Encoding" value={encodingLabel(selectedTexture)}/>
            <InfoRow label="File color space" value={colorSpaceLabel(selectedTexture)}/>

            <Divider sx={{mt: 1}}/>
            <SectionTitle>Display</SectionTitle>
            <Box sx={{px: 2, pb: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1}}>
                <Tooltip title="Color space the framework displays textures in. Linear uploads data as-is; sRGB forces sRGB GPU formats (hardware sRGB decode). Applies to all textures.">
                    <Typography variant="body2" color="text.secondary">Display color space</Typography>
                </Tooltip>
                <ToggleButtonGroup exclusive size="small" aria-label="Display color space" value={displayColorSpace}
                                   onChange={(_e, next: ColorSpace | null) => next && recreate(() => applyDisplayColorSpace(next))}>
                    <ToggleButton value={ColorSpace.LINEAR} aria-label="Linear display" sx={{py: 0.25, px: 1, fontSize: 12, textTransform: "none"}}>Linear</ToggleButton>
                    <ToggleButton value={ColorSpace.SRGB} aria-label="sRGB display" sx={{py: 0.25, px: 1, fontSize: 12, textTransform: "none"}}>sRGB</ToggleButton>
                </ToggleButtonGroup>
            </Box>
            <Box sx={{px: 1}}>
                <SelectField label="Texture Format" tooltip={FORMAT_TOOLTIP}
                             value={textureFormat} options={formatOptions}
                             onChange={(value) => recreate(() => setTextureFormat(value))}/>
                {canGenerateMipmaps(selectedTexture) && (
                    <CheckboxField label="Generate mipmaps on GPU" tooltip={MIPMAPS_TOOLTIP}
                                   value={generateMipmaps}
                                   onChange={(value) => recreate(() => setGenerateMipmaps(value))}/>
                )}
            </Box>
            {textureError && (
                <Alert severity="error" onClose={() => setTextureError(null)} sx={{m: 1}}>
                    {textureError}
                </Alert>
            )}
        </Stack>
    );
}

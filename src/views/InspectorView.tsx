import {useState} from "react";
import {Alert, Box, Divider, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography} from "@mui/material";
import {ColorSpace, TextureFormat, TextureUtilities} from "ris-framework";
import {VkFormat} from "ris-ktx2";
import {SelectField, type SelectOption} from "../components/fields/SelectField.tsx";
import {CheckboxField} from "../components/fields/CheckboxField.tsx";
import {textureFormatToString} from "../service/mapper.ts";
import {colorSpaceLabel, encodingLabel, NO_VALUE} from "../service/textureInfo.ts";
import {
    arrayLayerCount,
    canGenerateMipmaps,
    formatFileSize,
    textureDetails,
    useSelectedTexture,
    useTextureStore,
} from "../store/TextureStore.ts";
import {useViewerStore} from "../store/viewerStore.ts";
import {InfoRow, SectionTitle} from "../components/InfoSection.tsx";
import type {ITexture2DContainer} from "../model/ITexture2DContainer.ts";

const FORMAT_TOOLTIP = "GPU texture format used to display this texture. _SRGB formats treat the data as sRGB color (decoded when sampled); the others (UNORM) as linear data, e.g. normal maps. Defaults to sRGB for images and to the file's own color space for KTX2. Compressed formats reduce memory usage, at the expense of quality.";
const MIPMAPS_TOOLTIP = "Generates mipmaps on the GPU at display time (they are not stored in the file). Smaller versions of the texture improve quality and reduce sampling artifacts when it is shown at reduced sizes.";

/** Compressed formats offered for Basis Universal textures (transcode targets), in order of preference. */
const BASIS_TRANSCODE_FORMATS = [
    TextureFormat.BC7_RGBA_UNORM,
    TextureFormat.ASTC_4X4_UNORM,
    TextureFormat.BC3_RGBA_UNORM,
    TextureFormat.ETC2_RGBA8_UNORM,
];

const PVRTC_ARRAY_REASON = "PVRTC can't be used for texture arrays";

/** The sRGB and linear (UNORM) variant of `format`, sRGB first; one entry when it has no sRGB pair (PVRTC). */
function srgbPair(format: TextureFormat): TextureFormat[] {
    const srgb = TextureUtilities.convertToSrgbVariant(format);
    const linear = TextureUtilities.convertToLinearVariant(format);
    return srgb === linear ? [format] : [srgb, linear];
}

/**
 * Formats the selected texture can be uploaded as, each in its sRGB and linear (UNORM) variant; the pick sets the
 * texture's own color space (independent of the Display switch, which only sets the output). Images: RGBA8.
 * Non-Basis KTX2 data is uploaded as-is, so it offers its current format's pair (same bytes, reinterpreted).
 * Basis data offers RGBA8 plus every transcode target the GPU supports on the active backend
 * (`features.supportsTextureFormat`, so WebGPU never lists PVRTC). Texture arrays can use every compressed format
 * the device supports except PVRTC (WebGL allows it on TEXTURE_2D only), which is shown disabled with the reason.
 */
function useTextureFormatOptions(current: TextureFormat | undefined): SelectOption<TextureFormat>[] {
    const ktx = useSelectedTexture()?.ktxContainer;
    const framework = useViewerStore((state) => state.framework);
    const features = framework?.graphicsDevice.features;
    const supported = (format: TextureFormat) => !features || features.supportsTextureFormat(format);
    const toOption = (format: TextureFormat): SelectOption<TextureFormat> => ({value: format, label: textureFormatToString(format)});

    const isBasisCompressed = Boolean(ktx?.needsTranscoding) && ktx?.vkFormat === VkFormat.UNDEFINED;
    if (ktx && !isBasisCompressed && current != null) {
        const pair = srgbPair(current).filter((format) => format === current || supported(format));
        return pair.map(toOption);
    }

    const options = srgbPair(TextureFormat.RGBA8_UNORM).filter(supported).map(toOption);
    if (!isBasisCompressed || !features) {
        return options;
    }
    for (const base of BASIS_TRANSCODE_FORMATS) {
        options.push(...srgbPair(base).filter(supported).map(toOption));
    }

    // PVRTC1 (WEBGL_compressed_texture_pvrtc, mostly iOS/PowerVR): 4bpp RGBA and RGB, no sRGB variant, and it needs a
    // square power-of-two texture, so other sizes get a disabled entry with the reason.
    if (ktx) {
        const pot = isSquarePowerOfTwo(ktx.width, ktx.height);
        for (const format of [TextureFormat.PVRTC1_RGBA_4BPP_UNORM, TextureFormat.PVRTC1_RGB_4BPP_UNORM]) {
            if (!features.supportsTextureFormat(format)) {
                continue;
            }
            const name = textureFormatToString(format);
            const reason = ktx.isArray ? PVRTC_ARRAY_REASON : pot ? null : "needs square power-of-two size";
            options.push({value: format, label: reason ? `${name} (${reason})` : name, disabled: reason !== null});
        }
    }
    return options;
}

function isSquarePowerOfTwo(width: number, height: number): boolean {
    return width === height && width > 0 && (width & (width - 1)) === 0;
}

/**
 * Right panel: Info (read-only details of the selected texture) and Display (GPU format, mipmaps).
 * View, filter and mip level live in the viewport toolbar.
 * The selected-texture body is keyed by id so a leftover format/mipmaps error is not shown on the next texture.
 */
export function InspectorView() {
    const selectedTexture = useSelectedTexture();
    if (!selectedTexture) {
        return (
            <Box sx={{p: 2}}>
                <Typography variant="body2" color="text.secondary">
                    Select or add a texture to see its details.
                </Typography>
            </Box>
        );
    }
    return <InspectorBody key={selectedTexture.id} selectedTexture={selectedTexture}/>;
}

function InspectorBody({selectedTexture}: {selectedTexture: ITexture2DContainer}) {
    const texture = selectedTexture.texture;
    const {textureFormat, generateMipmaps, resolution, size, mipLevels} = textureDetails(texture);
    const setTextureFormat = useTextureStore((store) => store.setTextureFormat);
    const setGenerateMipmaps = useTextureStore((store) => store.setGenerateMipmaps);
    const layer = useTextureStore((store) => store.layer);
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

    return (
        <Stack sx={{pb: 1}}>
            <Typography variant="subtitle2" sx={{px: 2, pt: 1.5, wordBreak: "break-all"}}>
                {selectedTexture.name}
            </Typography>

            <SectionTitle>Info</SectionTitle>
            <InfoRow label="Resolution" value={texture ? resolution : NO_VALUE}/>
            <InfoRow label="Mip levels" value={texture ? mipLevels : NO_VALUE}/>
            {arrayLayerCount(selectedTexture) > 0 && (
                <InfoRow label="Layers" value={`${arrayLayerCount(selectedTexture)} (2D array, showing ${layer})`}/>
            )}
            <InfoRow label="File size" value={formatFileSize(selectedTexture.fileSize)}/>
            <InfoRow label="GPU memory" value={texture ? size : NO_VALUE}/>
            <InfoRow label="Encoding" value={encodingLabel(selectedTexture)}/>
            <InfoRow label="File color space" value={colorSpaceLabel(selectedTexture)}/>

            <Divider sx={{mt: 1}}/>
            <SectionTitle>Display</SectionTitle>
            <Box sx={{px: 2, pb: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1}}>
                <Tooltip title="Renderer output for all textures. sRGB: the output is encoded to sRGB (color-managed; use with _SRGB texture formats). Linear: no conversion; values go to the screen as-is. Each texture's own sRGB/linear format is set in Texture Format.">
                    <Typography variant="body2" color="text.secondary">Display color space</Typography>
                </Tooltip>
                <ToggleButtonGroup exclusive size="small" aria-label="Display color space" value={displayColorSpace}
                                   onChange={(_e, next: ColorSpace | null) => next && recreate(() => applyDisplayColorSpace(next))}>
                    <ToggleButton value={ColorSpace.SRGB} aria-label="sRGB display" sx={{py: 0.25, px: 1, fontSize: 12, textTransform: "none"}}>sRGB</ToggleButton>
                    <ToggleButton value={ColorSpace.LINEAR} aria-label="Linear display" sx={{py: 0.25, px: 1, fontSize: 12, textTransform: "none"}}>Linear</ToggleButton>
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

import {useState} from "react";
import {Alert, Divider, Stack} from "@mui/material";
import {SamplerFilter, TextureFormat} from "ris-framework";
import {VkFormat} from "ris-ktx2";
import {Panel} from "../components/Panel.tsx";
import {SelectField, type SelectOption} from "../components/fields/SelectField.tsx";
import {CheckboxField} from "../components/fields/CheckboxField.tsx";
import {View2D, View3D} from "../model/View.ts";
import {textureFormatToString} from "../service/mapper.ts";
import {canGenerateMipmaps, textureDetails, useSelectedTexture, useTextureStore} from "../store/TextureStore.ts";
import {useViewerStore} from "../store/viewerStore.ts";

const VIEW_OPTIONS = [View2D, View3D];

const FILTER_OPTIONS = [
    {value: SamplerFilter.NEAREST, label: "Nearest"},
    {value: SamplerFilter.LINEAR, label: "Linear"},
];

const VIEW_TOOLTIP = "Switches between flat 2D inspection and an orbit-camera 3D preview.";
const FILTER_TOOLTIP = "Controls how texture pixels are sampled when the texture is scaled or viewed at different sizes. Linear filtering produces smoother results, while nearest filtering preserves sharp, pixelated edges.";
const FORMAT_TOOLTIP = "Specifies the GPU texture format used to display the texture. Compressed formats reduce memory usage, at the expense of quality.";
const MIPMAPS_TOOLTIP = "Generates smaller versions of the texture for use when the texture is displayed at reduced sizes. Mipmaps can improve visual quality and reduce texture sampling artifacts.";
const MIP_LEVEL_TOOLTIP = "Selects which mipmap level of the texture to display. Level 0 is the full-resolution texture; higher levels contain progressively smaller versions.";

/**
 * GPU formats the selected texture can be displayed in: always RGBA8, plus the
 * compressed formats the GPU supports when the texture is Basis Universal (transcodable).
 */
function useTextureFormatOptions(): SelectOption<TextureFormat>[] {
    const ktx = useSelectedTexture()?.ktxContainer;
    const framework = useViewerStore((state) => state.framework);
    const features = framework?.graphicsDevice.features;

    const isBasisCompressed = Boolean(ktx?.needsTranscoding) && ktx?.vkFormat === VkFormat.UNDEFINED;
    const formats = [
        TextureFormat.RGBA_8_UNORM,
        ...(isBasisCompressed && features ? [
            features.supportsTextureCompressionBC && TextureFormat.BC7_RGBA_UNORM,
            features.supportsTextureCompressionASTC && TextureFormat.ASTC_4X4_RGBA,
            features.supportsTextureCompressionS3TC && TextureFormat.BC3_RGBA_UNORM,
            features.supportsTextureCompressionETC2 && TextureFormat.ETC2_RGBA8_UNORM,
        ] : []),
    ].filter((format) => format !== false);

    return formats.map((format) => ({value: format, label: textureFormatToString(format)}));
}

/**
 * Right column: view / sampler / texture settings for the selected texture.
 */
export function PropertiesView() {
    const selectedTexture = useSelectedTexture();
    const {textureFormat, generateMipmaps, mipLevels} = textureDetails(selectedTexture?.texture);
    const setTextureFormat = useTextureStore((store) => store.setTextureFormat);
    const setGenerateMipmaps = useTextureStore((store) => store.setGenerateMipmaps);
    const mipLevel = useTextureStore((store) => store.mipLevel);
    const setMipLevel = useTextureStore((store) => store.setMipLevel);

    const view = useViewerStore(store => store.view);
    const setView = useViewerStore((store) => store.setView);
    const filter = useViewerStore((store) => store.filter);
    const setFilter = useViewerStore((store) => store.setFilter);

    const [textureError, setTextureError] = useState<string | null>(null);

    const formatOptions = useTextureFormatOptions();
    const mipLevelOptions = Array.from({length: mipLevels}, (_, level) => level);

    /** Recreating the GPU texture can fail (e.g. transcode); the store keeps the current texture then. */
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
        <Panel>
            <Stack direction="column">
                <SelectField label="View" tooltip={VIEW_TOOLTIP}
                             value={view} options={VIEW_OPTIONS} onChange={setView}/>
                <Divider/>
                <SelectField label="Filter" tooltip={FILTER_TOOLTIP}
                             value={filter} options={FILTER_OPTIONS} onChange={setFilter}/>
                <Divider/>
                <SelectField label="Texture Format" tooltip={FORMAT_TOOLTIP}
                             value={textureFormat} options={formatOptions}
                             onChange={(value) => recreate(() => setTextureFormat(value))}/>
                {canGenerateMipmaps(selectedTexture) && (
                    <>
                        <Divider/>
                        <CheckboxField label="Generate Mipmaps" tooltip={MIPMAPS_TOOLTIP}
                                       value={generateMipmaps}
                                       onChange={(value) => recreate(() => setGenerateMipmaps(value))}/>
                    </>
                )}
                {view === View2D && mipLevels > 1 && (
                    <>
                        <Divider/>
                        <SelectField label="Mipmap Level" tooltip={MIP_LEVEL_TOOLTIP}
                                     value={mipLevel} options={mipLevelOptions} onChange={setMipLevel}/>
                    </>
                )}
                {textureError && (
                    <Alert severity="error" onClose={() => setTextureError(null)} sx={{m: 1}}>
                        {textureError}
                    </Alert>
                )}
            </Stack>
        </Panel>
    );
}

import {useState} from "react";
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    LinearProgress,
    Stack,
    useMediaQuery,
    useTheme,
} from "@mui/material";
import {useTextureStore} from "../store/TextureStore.ts";
import {useViewerStore} from "../store/ViewerStore.ts";
import {convertToKtx2Async} from "../service/Ktx2Converter.ts";
import {changeFileExtension} from "../service/formatter.ts";
import {TextInputField} from "../components/fields/TextInputField.tsx";
import {SelectField} from "../components/fields/SelectField.tsx";
import {CheckboxField} from "../components/fields/CheckboxField.tsx";
import {SliderField} from "../components/fields/SliderField.tsx";
import {KTX2_FILE_EXTENSION} from "../model/FileExtensionConstants.ts";
import type {ITexture2DContainer} from "../model/ITexture2DContainer.ts";
import {ConvertParameters} from "../model/ConvertParameters.ts";
import {
    KTX_ENCODING_BASIS_UNIVERSAL_ETC1S,
    KTX_ENCODING_BASIS_UNIVERSAL_UASTC,
    KTX_ENCODING_RGBA
} from "../model/Ktx2EncodingConstants.ts";
import {
    KTX_HIGH_QUALITY,
    KTX_HIGHEST_QUALITY,
    KTX_LOW_QUALITY,
    KTX_LOWEST_QUALITY,
    KTX_MEDIUM_QUALITY
} from "../model/CompressionQualityConstants.ts";
import {
    KTX_COMPRESSION_NONE,
    KTX_COMPRESSION_ZLIB,
    KTX_COMPRESSION_ZSTANDARD
} from "../model/Ktx2CompressionConstants.ts";
import {
    RDO_BALANCED,
    RDO_HIGH_QUALITY,
    RDO_HIGHEST_QUALITY,
    RDO_QUALITY_OPTIONS,
    RDO_SMALLER_FILE,
    RDO_SMALLEST_FILE,
} from "../model/RDOCompressionConstants.ts";

const ENCODING_OPTIONS = [KTX_ENCODING_RGBA, KTX_ENCODING_BASIS_UNIVERSAL_UASTC, KTX_ENCODING_BASIS_UNIVERSAL_ETC1S];
const QUALITY_OPTIONS = [KTX_LOWEST_QUALITY, KTX_LOW_QUALITY, KTX_MEDIUM_QUALITY, KTX_HIGH_QUALITY, KTX_HIGHEST_QUALITY];
const COMPRESSION_OPTIONS = [KTX_COMPRESSION_NONE, KTX_COMPRESSION_ZSTANDARD, KTX_COMPRESSION_ZLIB];

const FILE_NAME_TOOLTIP = "Name of the output KTX2 file saved after conversion.";

const ENCODING_TOOLTIP = "Encode the texture with the specified codec before saving it.";
const ENCODING_VALUE_TOOLTIPS: Record<string, string> = {
    [KTX_ENCODING_BASIS_UNIVERSAL_UASTC]: "Encode the texture using UASTC, providing high-quality GPU texture compression.",
    [KTX_ENCODING_BASIS_UNIVERSAL_ETC1S]: "Encode the texture using ETC1S, providing smaller files at the cost of image quality.",
    [KTX_ENCODING_RGBA]: "Store the texture as uncompressed raw RGBA data without texture encoding.",
};

const MIPMAPS_TOOLTIP = "Generates smaller versions of the texture for use when displayed at reduced sizes. Mipmaps can improve visual quality and reduce texture sampling artifacts.";

const UASTC_QUALITY_TOOLTIP = "Controls UASTC encoding quality versus encode time. Higher quality produces better image fidelity but takes longer to encode.";
const ETC1S_QUALITY_TOOLTIP = "Controls ETC1S image quality versus file size. Higher quality preserves more detail but produces larger files and takes longer to encode.";

const COMPRESSION_TOOLTIP = "Applies lossless supercompression to reduce file size after encoding. Unavailable for ETC1S, which already uses its own built-in compression.";
const COMPRESSION_VALUE_TOOLTIPS: Record<string, string> = {
    [KTX_COMPRESSION_NONE]: "Store the encoded texture without additional lossless compression.",
    [KTX_COMPRESSION_ZSTANDARD]: "Apply Zstandard lossless supercompression for smaller files. Generally preferred over ZLib.",
    [KTX_COMPRESSION_ZLIB]: "Apply ZLib lossless supercompression for smaller files.",
};

const COMPRESSION_LEVEL_ZSTD_TOOLTIP = "Higher levels produce smaller files but take longer and use more memory. Range is 1–22; values above 20 need substantially more memory.";
const COMPRESSION_LEVEL_ZLIB_TOOLTIP = "Higher levels produce smaller files but take longer to compress. Range is 1–9.";

const RDO_QUALITY_TOOLTIP = "Rate-Distortion Optimization conditions UASTC data so lossless compression packs it more tightly. Prefer higher quality for less visual change, or smaller file for stronger size reduction.";
const RDO_VALUE_TOOLTIPS: Record<string, string> = {
    [RDO_SMALLEST_FILE]: "Strongest size reduction; more visible quality loss after lossless compression.",
    [RDO_SMALLER_FILE]: "Favors a smaller file with a moderate quality trade-off.",
    [RDO_BALANCED]: "Balanced trade-off between visual quality and compressed file size.",
    [RDO_HIGH_QUALITY]: "Preserves more image quality; produces a larger compressed file.",
    [RDO_HIGHEST_QUALITY]: "Least aggressive RDO; closest to the original UASTC quality with a larger file.",
};

export default function ConvertDialog() {
    const framework = useViewerStore(store => store.framework);
    const selectedTexture = useTextureStore(store => store.selectedTexture);
    const addTexture = useTextureStore(store => store.addTexture);

    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

    const [open, setOpen] = useState(false);
    const [filename, setFilename] = useState("");
    const [converting, setConverting] = useState(false);
    const [convertError, setConvertError] = useState<string | null>(null);
    const [encoding, setEncoding] = useState(KTX_ENCODING_BASIS_UNIVERSAL_UASTC);
    const [compression, setCompression] = useState(KTX_COMPRESSION_ZSTANDARD);
    const [compressionLevelZstd, setCompressionLevelZstd] = useState(19);
    const [compressionLevelZLib, setCompressionLevelZLib] = useState(6);
    const [uastcQuality, setUastcQuality] = useState(KTX_MEDIUM_QUALITY);
    const [etc1sQuality, setEtc1sQuality] = useState(KTX_MEDIUM_QUALITY);
    const [generateMipmaps, setGenerateMipmaps] = useState(false);
    const [rdoQuality, setRdoQuality] = useState(RDO_BALANCED);

    const isUastc = encoding === KTX_ENCODING_BASIS_UNIVERSAL_UASTC;
    const isEtc1s = encoding === KTX_ENCODING_BASIS_UNIVERSAL_ETC1S;

    const handleOpen = () => {
        const name = selectedTexture?.name ?? "";
        setFilename(name ? changeFileExtension(name, KTX2_FILE_EXTENSION) ?? "ktx.ktx2" : "");
        setConvertError(null);
        setOpen(true);
    };

    const handleClose = () => {
        if (converting) {
            return;
        }
        setOpen(false);
        setConvertError(null);
    };

    const handleConvert = async () => {
        setConverting(true);
        setConvertError(null);

        const convertParams = new ConvertParameters();
        convertParams.fileName = filename;
        convertParams.encoding = encoding;
        convertParams.uastcQuality = uastcQuality;
        convertParams.etc1sQuality = etc1sQuality;
        convertParams.rdoQuality = rdoQuality;
        convertParams.generateMipmaps = generateMipmaps;
        convertParams.compression = compression;
        convertParams.compressionLevelZstd = compressionLevelZstd;
        convertParams.compressionLevelZLib = compressionLevelZLib;

        try {
            if (!framework) {
                // This should never happen.
                throw new Error("Framework not set");
            }
            if (!selectedTexture) {
                // This should never happen.
                throw new Error("No texture selected");
            }

            const result = await convertToKtx2Async(framework, selectedTexture, convertParams);
            if (result.success) {
                const ktx = result.ktx!;
                // Must create a copy since original might end up being transcoded internally.
                const ktxCopy = ktx.createCopy();
                const texContainer: ITexture2DContainer = {
                    name: result.name!,
                    ktxContainer: ktx,
                    texture: framework.textureFactory.createFromKtx2(ktxCopy),
                    image: null,
                };
                await addTexture(texContainer);
                ktxCopy.delete();
                setOpen(false);
                setConvertError(null);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error("Convert failed:", err);
            setConvertError(message);
        } finally {
            setConverting(false);
        }
    };

    return (
        <>
            <Button variant="outlined" onClick={handleOpen} disabled={!selectedTexture?.image}>
                Convert
            </Button>
            <Dialog open={open}
                    onClose={handleClose}
                    fullWidth
                    maxWidth="md"
                    fullScreen={fullScreen}
                    aria-busy={converting}
            >
                <DialogTitle>Convert To Ktx2</DialogTitle>
                <DialogContent>
                    <Stack spacing={1.2}>
                        <TextInputField row label="File Name" tooltip={FILE_NAME_TOOLTIP}
                                        value={filename} onChange={setFilename}/>

                        <SelectField row label="Encode" tooltip={ENCODING_TOOLTIP}
                                     value={encoding} options={ENCODING_OPTIONS} onChange={setEncoding}
                                     valueTooltip={ENCODING_VALUE_TOOLTIPS[encoding]}/>

                        <CheckboxField row label="Generate Mipmaps" tooltip={MIPMAPS_TOOLTIP}
                                       value={generateMipmaps} onChange={setGenerateMipmaps}/>

                        {isUastc &&
                            <SelectField row label="UASTC Quality" tooltip={UASTC_QUALITY_TOOLTIP}
                                         value={uastcQuality} options={QUALITY_OPTIONS} onChange={setUastcQuality}/>
                        }

                        {isEtc1s &&
                            <SelectField row label="ETC1S Quality" tooltip={ETC1S_QUALITY_TOOLTIP}
                                         value={etc1sQuality} options={QUALITY_OPTIONS} onChange={setEtc1sQuality}/>
                        }

                        {/* ETC1S does not support ZSTD or ZLIB compression */}
                        {!isEtc1s && (
                            <>
                                <SelectField row label="Compression" tooltip={COMPRESSION_TOOLTIP}
                                             value={compression} options={COMPRESSION_OPTIONS} onChange={setCompression}
                                             valueTooltip={COMPRESSION_VALUE_TOOLTIPS[compression]}/>
                                {compression === KTX_COMPRESSION_ZSTANDARD &&
                                    <SliderField row label="Compression Level" tooltip={COMPRESSION_LEVEL_ZSTD_TOOLTIP}
                                                 min={1} max={22}
                                                 value={compressionLevelZstd} onChange={setCompressionLevelZstd}/>
                                }
                                {compression === KTX_COMPRESSION_ZLIB &&
                                    <SliderField row label="Compression Level" tooltip={COMPRESSION_LEVEL_ZLIB_TOOLTIP}
                                                 min={1} max={9}
                                                 value={compressionLevelZLib} onChange={setCompressionLevelZLib}/>
                                }
                            </>
                        )}

                        {/* Compression RDO is available for UASTC with ZLIB or ZSTD */}
                        {isUastc && compression !== KTX_COMPRESSION_NONE &&
                            <SelectField row label="RDO Quality" tooltip={RDO_QUALITY_TOOLTIP}
                                         value={rdoQuality} options={RDO_QUALITY_OPTIONS} onChange={setRdoQuality}
                                         valueTooltip={RDO_VALUE_TOOLTIPS[rdoQuality]}/>
                        }

                        {convertError && (
                            <Alert severity="error" onClose={() => setConvertError(null)}>
                                {convertError}
                            </Alert>
                        )}
                    </Stack>
                    <LinearProgress aria-label="Converting…" sx={{display: converting ? 'block' : 'none', mt: 1}}/>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose} disabled={converting}>Cancel</Button>
                    <Button onClick={handleConvert} variant="contained" disabled={converting}>
                        Convert
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}

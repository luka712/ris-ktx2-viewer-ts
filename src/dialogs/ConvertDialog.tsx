import {useState} from "react";
import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    LinearProgress,
    List,
    ListItem,
    ListItemText,
    Stack,
    Tooltip,
    Typography,
    useMediaQuery,
    useTheme,
} from "@mui/material";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import {useConvertStore} from "../store/ConvertStore.ts";
import {changeFileExtension} from "../service/formatter.ts";
import {TextInputField} from "../components/fields/TextInputField.tsx";
import {SelectField} from "../components/fields/SelectField.tsx";
import {CheckboxField} from "../components/fields/CheckboxField.tsx";
import {SliderField} from "../components/fields/SliderField.tsx";
import {KTX2_FILE_EXTENSION} from "../model/FileExtensionConstants.ts";
import type {ITexture2DContainer} from "../model/ITexture2DContainer.ts";
import {ConvertParameters} from "../model/ConvertParameters.ts";
import {clearConvertOptions, loadConvertOptions, saveConvertOptions} from "../service/convertOptionsStorage.ts";
import {useDismissedFlag} from "../hooks/useDismissedFlag.ts";
import type {ConvertMode} from "./ConvertModeDialog.tsx";
import {arrayFileName, arraySourceProblem, moveItem} from "../service/textureArray.ts";
import {useViewerStore} from "../store/viewerStore.ts";
import {arrayLayerLimitProblem, maxTextureArrayLayers} from "../service/textureResources.ts";
import {
    ASTC_BLOCK_SIZE_OPTIONS,
    ASTC_BLOCK_SIZE_TOOLTIP,
    ASTC_MODE_OPTIONS,
    ASTC_MODE_TOOLTIP,
    ASTC_NORMAL_MAP_TOOLTIP,
    ASTC_QUALITY_OPTIONS,
    ASTC_QUALITY_TOOLTIP,
} from "../model/AstcConstants.ts";
import {
    KTX_ENCODING_ASTC,
    KTX_ENCODING_BASIS_UNIVERSAL_ETC1S,
    KTX_ENCODING_BASIS_UNIVERSAL_UASTC,
} from "../model/Ktx2EncodingConstants.ts";
import {
    KTX_COMPRESSION_NONE,
    KTX_COMPRESSION_ZLIB,
    KTX_COMPRESSION_ZSTANDARD
} from "../model/Ktx2CompressionConstants.ts";
import {RDO_QUALITY_OPTIONS} from "../model/RDOCompressionConstants.ts";
import {
    BLOCK_ALIGN_TOOLTIP,
    COMPRESSION_LEVEL_ZLIB_TOOLTIP,
    COMPRESSION_LEVEL_ZSTD_TOOLTIP,
    COMPRESSION_OPTIONS,
    COMPRESSION_TOOLTIP,
    COMPRESSION_VALUE_TOOLTIPS,
    DEFAULT_COMPRESSION_LEVEL_ZLIB,
    DEFAULT_COMPRESSION_LEVEL_ZSTD,
    ENCODING_OPTIONS,
    ENCODING_TOOLTIP,
    ENCODING_VALUE_TOOLTIPS,
    ETC1S_QUALITY_TOOLTIP,
    FILE_NAME_TOOLTIP,
    MIPMAPS_TOOLTIP,
    SRGB_TOOLTIP,
    QUALITY_OPTIONS,
    RDO_QUALITY_TOOLTIP,
    RDO_VALUE_TOOLTIPS,
    UASTC_QUALITY_TOOLTIP,
} from "../model/ConvertOptionsConstants.ts";

const SLOW_WARNING_STORAGE_KEY = "ris-ktx2-viewer.convertSlowWarningDismissed";
const CANNOT_CANCEL_TOOLTIP = "This conversion is running on the main thread and can't be cancelled.";

interface ConvertDialogProps {
    open: boolean;
    /** Single texture, one file per texture ("separate"), or one texture array ("array"). */
    mode: ConvertMode;
    /**
     * Textures to convert, in list order (one for "single"; the array's initial layer order for "array").
     * Read when the dialog instance mounts (see ConvertButton).
     */
    textures: ITexture2DContainer[];
}

/** Default output name: the texture's name as .ktx2, "<first>_array.ktx2" for an array. Unused for "separate". */
function defaultFileName(mode: ConvertMode, textures: ITexture2DContainer[]): string {
    if (mode === "array") {
        return arrayFileName(textures);
    }
    const texture = textures[0];
    return mode === "single" && texture?.name ? changeFileExtension(texture.name, KTX2_FILE_EXTENSION) : "";
}

/** The entered file name, or the default one when it is empty (e.g. "" or ".ktx2"), so the download is never ".ktx2". */
function outputFileName(fileName: string, mode: ConvertMode, textures: ITexture2DContainer[]): string {
    const trimmed = (fileName ?? "").trim();
    return trimmed.replace(/\.ktx2$/i, "") === "" ? defaultFileName(mode, textures) : trimmed;
}

/** Built-in defaults (used when nothing is saved and by "Reset to defaults"). */
function defaultParameters(fileName: string): ConvertParameters {
    const params = new ConvertParameters();
    params.fileName = fileName;
    params.encoding = KTX_ENCODING_BASIS_UNIVERSAL_UASTC;
    params.compression = KTX_COMPRESSION_NONE;
    params.compressionLevelZstd = DEFAULT_COMPRESSION_LEVEL_ZSTD;
    params.compressionLevelZLib = DEFAULT_COMPRESSION_LEVEL_ZLIB;
    return params;
}

/** Defaults overlaid with the options saved on the last Convert (see convertOptionsStorage). */
function initialParameters(fileName: string): ConvertParameters {
    return loadConvertOptions(defaultParameters(fileName));
}

const DIALOG_TITLES: Record<ConvertMode, string> = {
    single: "Convert To Ktx2",
    separate: "Convert To Separate Ktx2 Files",
    array: "Create Ktx2 Texture Array",
};

const ARRAY_OPTIONS_NOTE = "Encoding, mipmaps and extra compression apply to every layer. "
    + "The viewer shows one layer at a time; pick it next to the mip level.";

/** "Separate files": what each source is written as. */
function SeparateFilesList({textures}: { textures: ITexture2DContainer[] }) {
    return (
        <Box>
            <Typography variant="body2" sx={{opacity: 0.75}}>{`Files (${textures.length})`}</Typography>
            <List dense disablePadding sx={{maxHeight: 160, overflowY: "auto"}} aria-label="Files to convert">
                {textures.map((texture) => (
                    <ListItem key={texture.id} disableGutters sx={{py: 0}}>
                        <ListItemText primary={`${texture.name} → ${changeFileExtension(texture.name, KTX2_FILE_EXTENSION)}`}
                                      slotProps={{primary: {noWrap: true, title: texture.name, sx: {fontSize: 13}}}}/>
                    </ListItem>
                ))}
            </List>
        </Box>
    );
}

/** "Texture array": the layers in order, with up/down buttons to reorder them. */
function ArrayLayersList({layers, onChange}: {
    layers: ITexture2DContainer[];
    onChange: (layers: ITexture2DContainer[]) => void;
}) {
    return (
        <Box>
            <Typography variant="body2" sx={{opacity: 0.75}}>{`Layers (${layers.length}), top is layer 0`}</Typography>
            <List dense disablePadding sx={{maxHeight: 200, overflowY: "auto"}} aria-label="Array layers">
                {layers.map((texture, index) => (
                    <ListItem key={texture.id} disableGutters sx={{py: 0}}
                              secondaryAction={
                                  <>
                                      <IconButton size="small" aria-label={`Move ${texture.name} up`} disabled={index === 0}
                                                  onClick={() => onChange(moveItem(layers, index, -1))}>
                                          <KeyboardArrowUpIcon fontSize="small"/>
                                      </IconButton>
                                      <IconButton size="small" edge="end" aria-label={`Move ${texture.name} down`}
                                                  disabled={index === layers.length - 1}
                                                  onClick={() => onChange(moveItem(layers, index, 1))}>
                                          <KeyboardArrowDownIcon fontSize="small"/>
                                      </IconButton>
                                  </>
                              }>
                        <ListItemText primary={`${index}: ${texture.name}`}
                                      slotProps={{primary: {noWrap: true, title: texture.name, sx: {fontSize: 13}}}}/>
                    </ListItem>
                ))}
            </List>
        </Box>
    );
}

/**
 * Convert To Ktx2 dialog. Conversion state lives in ConvertStore, so closing the dialog
 * (button, Escape, backdrop) or unmounting it never stops a running conversion; the result
 * is still downloaded and added to the texture list. While a conversion runs, the form is
 * replaced by a status message and a new conversion cannot be started; "Cancel conversion"
 * is the only way to stop it (not available while the main-thread fallback runs).
 *
 * TODO: restructure layout (source/target | encoding options, sticky footer) — see TODO.md "UI layout".
 */
export default function ConvertDialog({open, mode, textures}: ConvertDialogProps) {
    const isConverting = useConvertStore(store => store.isConverting);
    const outputName = useConvertStore(store => store.outputName);
    const batch = useConvertStore(store => store.batch);
    const startBatchConversion = useConvertStore(store => store.startBatchConversion);
    const startArrayConversion = useConvertStore(store => store.startArrayConversion);
    const lastError = useConvertStore(store => store.lastError);
    const startConversion = useConvertStore(store => store.startConversion);
    const closeDialog = useConvertStore(store => store.closeDialog);
    const clearLastError = useConvertStore(store => store.clearLastError);
    const canCancel = useConvertStore(store => store.canCancel);
    const isCancelling = useConvertStore(store => store.isCancelling);
    const cancelConversion = useConvertStore(store => store.cancelConversion);

    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

    const [slowWarningDismissed, dismissSlowWarning] = useDismissedFlag(SLOW_WARNING_STORAGE_KEY);
    const [params, setParams] = useState(() => initialParameters(defaultFileName(mode, textures)));
    /** Layer order of the array (starts in list order). */
    const [layers, setLayers] = useState(textures);
    const texture = textures[0] ?? null;
    const arrayProblem = mode === "array" ? arraySourceProblem(layers) : null;
    const framework = useViewerStore((state) => state.framework);
    const layerLimitProblem = mode === "array" && arrayProblem === null
        ? arrayLayerLimitProblem(layers.length, maxTextureArrayLayers(framework)) : null;
    const canConvert = mode === "single" ? Boolean(texture?.image)
        : mode === "separate" ? textures.length > 0 && textures.every((item) => item.image)
            : arrayProblem === null;

    /** Setter for one form field. */
    const field = <K extends keyof ConvertParameters>(key: K) =>
        (value: ConvertParameters[K]) => setParams((prev) => ({...prev, [key]: value}));

    const isUastc = params.encoding === KTX_ENCODING_BASIS_UNIVERSAL_UASTC;
    const isEtc1s = params.encoding === KTX_ENCODING_BASIS_UNIVERSAL_ETC1S;
    const isAstc = params.encoding === KTX_ENCODING_ASTC;

    // Just temporary hide some of unused stuff
    const hideAsNotReady = true;

    const handleConvert = () => {
        if (!canConvert || !texture) {
            // This should never happen (Convert is disabled without source images).
            return;
        }
        saveConvertOptions(params);
        const outputParams = {...params, fileName: outputFileName(params.fileName, mode, mode === "array" ? layers : textures)};
        if (mode === "separate") {
            void startBatchConversion(textures, outputParams);
        } else if (mode === "array") {
            void startArrayConversion(layers, outputParams);
        } else {
            void startConversion(texture, outputParams);
        }
    };

    return (
        <Dialog open={open}
                onClose={closeDialog}
                fullWidth
                maxWidth="md"
                fullScreen={fullScreen}
                aria-busy={isConverting}
        >
            <DialogTitle>{DIALOG_TITLES[mode]}</DialogTitle>
            <DialogContent>
                {isConverting ? (
                    <Stack spacing={1.2}>
                        <Alert severity="info">
                            Converting {outputName}{batch && ` (file ${batch.index + 1} of ${batch.total})`}…
                            A new conversion can start when this one finishes.
                            You can close this dialog; the conversion keeps running in the background and
                            the result is added to the texture list.
                        </Alert>
                        {batch
                            ? <LinearProgress aria-label="Converting…" variant="determinate"
                                              value={(batch.index / batch.total) * 100}/>
                            : <LinearProgress aria-label="Converting…"/>}
                    </Stack>
                ) : (
                    <Stack spacing={1.2}>
                        {!slowWarningDismissed && (
                            <Alert severity="warning" onClose={dismissSlowWarning}
                                   slotProps={{closeButton: {"aria-label": "Dismiss conversion time warning"}}}>
                                Note that conversion to compressed KTX2 formats can be slow, even on fast hardware.
                            </Alert>
                        )}
                        {mode === "separate" && <SeparateFilesList textures={textures}/>}
                        {mode !== "separate" &&
                            <TextInputField row label="File Name" tooltip={FILE_NAME_TOOLTIP}
                                            value={params.fileName} onChange={field("fileName")}/>
                        }
                        {mode === "array" && (
                            <>
                                <ArrayLayersList layers={layers} onChange={setLayers}/>
                                {arrayProblem
                                    ? <Alert severity="warning">{arrayProblem}</Alert>
                                    : <Typography variant="caption" color="text.secondary">{ARRAY_OPTIONS_NOTE}</Typography>}
                                {layerLimitProblem &&
                                    <Alert severity="warning">{`${layerLimitProblem} The file will be saved, but can't be shown here.`}</Alert>}
                            </>
                        )}

                        <SelectField row label="Encode" tooltip={ENCODING_TOOLTIP}
                                     value={params.encoding} options={ENCODING_OPTIONS} onChange={field("encoding")}
                                     valueTooltip={ENCODING_VALUE_TOOLTIPS[params.encoding]}/>

                        <CheckboxField row label="sRGB (color data)" tooltip={SRGB_TOOLTIP}
                                       value={params.srgb} onChange={field("srgb")}/>

                        <CheckboxField row label="Mipmaps" tooltip={MIPMAPS_TOOLTIP}
                                       value={params.generateMipmaps} onChange={field("generateMipmaps")}/>

                        {isUastc &&
                            <SelectField row label="UASTC Quality" tooltip={UASTC_QUALITY_TOOLTIP}
                                         value={params.uastcQuality} options={QUALITY_OPTIONS}
                                         onChange={field("uastcQuality")}/>
                        }

                        {isEtc1s &&
                            <SelectField row label="ETC1S Quality" tooltip={ETC1S_QUALITY_TOOLTIP}
                                         value={params.etc1sQuality} options={QUALITY_OPTIONS}
                                         onChange={field("etc1sQuality")}/>
                        }

                        {isAstc && (
                            <>
                                <SelectField row label="ASTC Block Size" tooltip={ASTC_BLOCK_SIZE_TOOLTIP}
                                             value={params.astcBlockSize} options={ASTC_BLOCK_SIZE_OPTIONS}
                                             onChange={field("astcBlockSize")}/>
                                <SelectField row label="ASTC Quality" tooltip={ASTC_QUALITY_TOOLTIP}
                                             value={params.astcQuality} options={ASTC_QUALITY_OPTIONS}
                                             onChange={field("astcQuality")}/>
                                {!(hideAsNotReady) &&
                                <SelectField row label="ASTC Mode" tooltip={ASTC_MODE_TOOLTIP}
                                             value={params.astcMode} options={ASTC_MODE_OPTIONS}
                                             onChange={field("astcMode")}/>
                                }
                                {!(hideAsNotReady) &&
                                <CheckboxField row label="Normal Map" tooltip={ASTC_NORMAL_MAP_TOOLTIP}
                                               value={params.astcNormalMap}
                                               onChange={(normalMap) => setParams((prev) => ({
                                                   ...prev,
                                                   astcNormalMap: normalMap,
                                                   // Normal maps are linear data; libktx only allows normalMap for non-sRGB.
                                                   srgb: normalMap ? false : prev.srgb,
                                               }))}/>
                                }
                            </>
                        )}

                        {(isUastc || isEtc1s || isAstc) &&
                            <CheckboxField value={params.blockAlign} onChange={field("blockAlign")} label="Pad to block size"
                                           row
                                           tooltip={BLOCK_ALIGN_TOOLTIP}
                            />}

                        {/* ETC1S does not support ZSTD or ZLIB compression */}
                        {!isEtc1s && (
                            <>
                                <SelectField row label="Extra compression" tooltip={COMPRESSION_TOOLTIP}
                                             value={params.compression} options={COMPRESSION_OPTIONS}
                                             onChange={field("compression")}
                                             valueTooltip={COMPRESSION_VALUE_TOOLTIPS[params.compression]}/>
                                {params.compression === KTX_COMPRESSION_ZSTANDARD &&
                                    <SliderField row label="Compression Level" tooltip={COMPRESSION_LEVEL_ZSTD_TOOLTIP}
                                                 min={1} max={22}
                                                 value={params.compressionLevelZstd}
                                                 onChange={field("compressionLevelZstd")}/>
                                }
                                {params.compression === KTX_COMPRESSION_ZLIB &&
                                    <SliderField row label="Compression Level" tooltip={COMPRESSION_LEVEL_ZLIB_TOOLTIP}
                                                 min={1} max={9}
                                                 value={params.compressionLevelZLib}
                                                 onChange={field("compressionLevelZLib")}/>
                                }
                            </>
                        )}

                        {/* Compression RDO is available for UASTC with ZLIB or ZSTD */}
                        {isUastc && params.compression !== KTX_COMPRESSION_NONE &&
                            <SelectField row label="RDO Quality" tooltip={RDO_QUALITY_TOOLTIP}
                                         value={params.rdoQuality} options={RDO_QUALITY_OPTIONS}
                                         onChange={field("rdoQuality")}
                                         valueTooltip={RDO_VALUE_TOOLTIPS[params.rdoQuality]}/>
                        }

                        {lastError && (
                            <Alert severity="error" onClose={clearLastError}>
                                {lastError}
                            </Alert>
                        )}
                    </Stack>
                )}
            </DialogContent>
            <DialogActions>
                {isConverting && (
                    <Tooltip title={canCancel ? "" : CANNOT_CANCEL_TOOLTIP}>
                        {/* Span so the tooltip still shows on the disabled button. */}
                        <span>
                            <Button color="error" onClick={cancelConversion} disabled={!canCancel || isCancelling}>
                                {isCancelling ? "Cancelling…" : "Cancel conversion"}
                            </Button>
                        </span>
                    </Tooltip>
                )}
                {!isConverting && (
                    <Button onClick={() => {
                        clearConvertOptions();
                        setParams((prev) => ({...defaultParameters(prev.fileName)}));
                    }} sx={{marginRight: "auto"}}>
                        Reset to defaults
                    </Button>
                )}
                <Button onClick={closeDialog}>
                    Close
                </Button>
                {!isConverting && (
                    <Button onClick={handleConvert} variant="contained" disabled={!canConvert}>
                        {mode === "separate" ? `Convert ${textures.length} files` : mode === "array" ? "Create array" : "Convert"}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}

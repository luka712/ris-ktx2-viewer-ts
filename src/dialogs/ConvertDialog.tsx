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
    Tooltip,
    useMediaQuery,
    useTheme,
} from "@mui/material";
import {useConvertStore} from "../store/ConvertStore.ts";
import {changeFileExtension} from "../service/formatter.ts";
import {TextInputField} from "../components/fields/TextInputField.tsx";
import {SelectField} from "../components/fields/SelectField.tsx";
import {CheckboxField} from "../components/fields/CheckboxField.tsx";
import {SliderField} from "../components/fields/SliderField.tsx";
import {KTX2_FILE_EXTENSION} from "../model/FileExtensionConstants.ts";
import type {ITexture2DContainer} from "../model/ITexture2DContainer.ts";
import {ConvertParameters} from "../model/ConvertParameters.ts";
import {useDismissedFlag} from "../hooks/useDismissedFlag.ts";
import {
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
    QUALITY_OPTIONS,
    RDO_QUALITY_TOOLTIP,
    RDO_VALUE_TOOLTIPS,
    UASTC_QUALITY_TOOLTIP,
} from "../model/ConvertOptionsConstants.ts";

const SLOW_WARNING_STORAGE_KEY = "ris-ktx2-viewer.convertSlowWarningDismissed";
const CANNOT_CANCEL_TOOLTIP = "This conversion is running on the main thread and can't be cancelled.";

interface ConvertDialogProps {
    open: boolean;
    /** Texture to convert. Read when the dialog instance mounts (see ConvertButton). */
    texture: ITexture2DContainer | null;
}

function initialParameters(texture: ITexture2DContainer | null): ConvertParameters {
    const params = new ConvertParameters();
    params.fileName = texture?.name ? changeFileExtension(texture.name, KTX2_FILE_EXTENSION) : "";
    params.encoding = KTX_ENCODING_BASIS_UNIVERSAL_UASTC;
    params.compression = KTX_COMPRESSION_NONE;
    params.compressionLevelZstd = DEFAULT_COMPRESSION_LEVEL_ZSTD;
    params.compressionLevelZLib = DEFAULT_COMPRESSION_LEVEL_ZLIB;
    return params;
}

/**
 * Convert To Ktx2 dialog. Conversion state lives in ConvertStore, so closing the dialog
 * (button, Escape, backdrop) or unmounting it never stops a running conversion; the result
 * is still downloaded and added to the texture list. While a conversion runs, the form is
 * replaced by a status message and a new conversion cannot be started; "Cancel conversion"
 * is the only way to stop it (not available while the main-thread fallback runs).
 */
export default function ConvertDialog({open, texture}: ConvertDialogProps) {
    const isConverting = useConvertStore(store => store.isConverting);
    const outputName = useConvertStore(store => store.outputName);
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
    const [params, setParams] = useState(() => initialParameters(texture));

    /** Setter for one form field. */
    const field = <K extends keyof ConvertParameters>(key: K) =>
        (value: ConvertParameters[K]) => setParams((prev) => ({...prev, [key]: value}));

    const isUastc = params.encoding === KTX_ENCODING_BASIS_UNIVERSAL_UASTC;
    const isEtc1s = params.encoding === KTX_ENCODING_BASIS_UNIVERSAL_ETC1S;

    const handleConvert = () => {
        if (!texture?.image) {
            // This should never happen (Convert is disabled without a source image).
            return;
        }
        void startConversion(texture, params);
    };

    return (
        <Dialog open={open}
                onClose={closeDialog}
                fullWidth
                maxWidth="md"
                fullScreen={fullScreen}
                aria-busy={isConverting}
        >
            <DialogTitle>Convert To Ktx2</DialogTitle>
            <DialogContent>
                {isConverting ? (
                    <Stack spacing={1.2}>
                        <Alert severity="info">
                            Converting {outputName}… A new conversion can start when this one finishes.
                            You can close this dialog; the conversion keeps running in the background and
                            the result is added to the texture list.
                        </Alert>
                        <LinearProgress aria-label="Converting…"/>
                    </Stack>
                ) : (
                    <Stack spacing={1.2}>
                        {!slowWarningDismissed && (
                            <Alert severity="warning" onClose={dismissSlowWarning}
                                   slotProps={{closeButton: {"aria-label": "Dismiss conversion time warning"}}}>
                                Note that conversion to compressed KTX2 formats can be slow, even on fast hardware.
                            </Alert>
                        )}
                        <TextInputField row label="File Name" tooltip={FILE_NAME_TOOLTIP}
                                        value={params.fileName} onChange={field("fileName")}/>

                        <SelectField row label="Encode" tooltip={ENCODING_TOOLTIP}
                                     value={params.encoding} options={ENCODING_OPTIONS} onChange={field("encoding")}
                                     valueTooltip={ENCODING_VALUE_TOOLTIPS[params.encoding]}/>

                        <CheckboxField row label="Generate Mipmaps" tooltip={MIPMAPS_TOOLTIP}
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

                        {(isUastc || isEtc1s) &&
                            <CheckboxField value={params.blockAlign} onChange={field("blockAlign")} label="Block Align"
                                           row
                                           tooltip={BLOCK_ALIGN_TOOLTIP}
                            />}

                        {/* ETC1S does not support ZSTD or ZLIB compression */}
                        {!isEtc1s && (
                            <>
                                <SelectField row label="Compression" tooltip={COMPRESSION_TOOLTIP}
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
                <Button onClick={closeDialog}>
                    Close
                </Button>
                {!isConverting && (
                    <Button onClick={handleConvert} variant="contained" disabled={!texture?.image}>
                        Convert
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}

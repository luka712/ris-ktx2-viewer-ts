import {Paper, Typography} from "@mui/material";
import {textureFormatToString} from "../../service/mapper.ts";
import {encodingLabel} from "../../service/textureInfo.ts";
import {useSelectedTexture} from "../../store/TextureStore.ts";
import {useViewerStore} from "../../store/viewerStore.ts";
import {backendName} from "../../service/backendStorage.ts";

/** One-line status bar: selected texture, size, KTX2 encoding and GPU format (details are in the Inspector). */
export function FooterView() {
    const selected = useSelectedTexture();
    const framework = useViewerStore((store) => store.framework);
    const gpu = framework?.renderer.graphicsDevice.gpuInfo.name;
    // Active backend (graphicsDevice.api); "…" while a framework is starting (e.g. during a backend switch).
    const selectedBackend = useViewerStore((store) => store.backend);
    const backend = framework ? backendName(framework.graphicsDevice.api) : `${backendName(selectedBackend)}…`;
    const texture = selected?.texture;

    const text = selected
        ? [selected.name, texture && `${texture.size[0]}×${texture.size[1]}`, selected.ktxContainer && encodingLabel(selected, true), texture && textureFormatToString(texture.textureFormat)]
            .filter(Boolean).join(" · ")
        : "No texture loaded";

    return (
        <Paper elevation={1} sx={{borderRadius: 2, px: {xs: 1, sm: 2}, py: 0.5, display: "flex", gap: 2}}>
            <Typography variant="caption" noWrap sx={{flex: 1, minWidth: 0}}>{text}</Typography>
            <Typography variant="caption" color="primary" noWrap sx={{flexShrink: 0, fontWeight: 500}}
                        aria-label={`Rendering backend ${backend}`}>
                {backend}
            </Typography>
            {gpu && (
                <Typography variant="caption" color="text.secondary" noWrap
                            sx={{display: {xs: "none", sm: "block"}, maxWidth: "40%"}}>
                    {gpu}
                </Typography>
            )}
        </Paper>
    );
}

import {Box, ListItemIcon, ListItemText, ListSubheader, MenuItem, ToggleButton, ToggleButtonGroup, Tooltip} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import {GpuBackend} from "ris-framework";
import {useViewerStore} from "../store/viewerStore.ts";
import {backendName, type ViewerBackend} from "../service/backendStorage.ts";

const BACKENDS: ViewerBackend[] = [GpuBackend.WEB_GL, GpuBackend.WEB_GPU];

const TOOLTIPS: Record<ViewerBackend, string> = {
    [GpuBackend.WEB_GL]: "Render with WebGL2",
    [GpuBackend.WEB_GPU]: "Render with WebGPU",
};

/** Backend options with WebGPU disabled (and why) when the browser has no WebGPU adapter. */
function useBackendOptions() {
    const backend = useViewerStore((store) => store.backend);
    const webGpu = useViewerStore((store) => store.webGpu);
    const setBackend = useViewerStore((store) => store.setBackend);
    const options = BACKENDS.map((value) => {
        const unavailable = value === GpuBackend.WEB_GPU && webGpu.status !== "available";
        const reason = !unavailable ? null
            : webGpu.status === "checking" ? "Checking WebGPU support…" : webGpu.reason;
        return {value, label: backendName(value), disabled: unavailable && value !== backend, reason};
    });
    return {backend, options, setBackend};
}

/**
 * Segmented WebGL2 | WebGPU switch (header, same style as the theme switch). Switching re-creates the GPU
 * framework and re-uploads every texture (see useFramework). Saved in localStorage.
 */
export function BackendSwitch() {
    const {backend, options, setBackend} = useBackendOptions();
    return (
        <ToggleButtonGroup
            exclusive
            size="small"
            aria-label="Rendering backend"
            // The buttons are wrapped for their tooltips, so they handle selection themselves.
            value={backend}
        >
            {options.map(({value, label, disabled, reason}) => (
                <Tooltip key={value} title={reason ?? TOOLTIPS[value]}>
                    {/* A span keeps the tooltip working on a disabled button. */}
                    <Box component="span" sx={{display: "inline-flex"}}>
                        <ToggleButton
                            value={value}
                            selected={backend === value}
                            disabled={disabled}
                            aria-label={label}
                            onClick={() => setBackend(value)}
                            sx={{px: {xs: 0.75, sm: 1.25}, py: 0.25, fontSize: 12, textTransform: "none",
                                // Re-join the group's borders broken by the tooltip span.
                                borderRadius: 0, ...(value === BACKENDS[0] ? {borderTopLeftRadius: 4, borderBottomLeftRadius: 4}
                                    : {borderTopRightRadius: 4, borderBottomRightRadius: 4, ml: "-1px"})}}
                        >
                            {label}
                        </ToggleButton>
                    </Box>
                </Tooltip>
            ))}
        </ToggleButtonGroup>
    );
}

/** The same choice as menu items, for the header Info menu on narrow screens. */
export function BackendMenuItems({onSelect}: { onSelect: () => void }) {
    const {backend, options, setBackend} = useBackendOptions();
    return [
        <ListSubheader key="header" sx={{lineHeight: "32px"}}>Rendering backend</ListSubheader>,
        ...options.map(({value, label, disabled, reason}) => (
            <MenuItem key={value} disabled={disabled} selected={backend === value}
                      onClick={() => {
                          setBackend(value);
                          onSelect();
                      }}>
                <ListItemIcon>{backend === value && <CheckIcon fontSize="small"/>}</ListItemIcon>
                <ListItemText primary={label} secondary={disabled ? reason : undefined}
                              slotProps={{secondary: {sx: {whiteSpace: "normal", maxWidth: 220}}}}/>
            </MenuItem>
        )),
    ];
}

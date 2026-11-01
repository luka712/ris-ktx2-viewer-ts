import {Box, IconButton, MenuItem, Paper, Select, ToggleButton, ToggleButtonGroup, Tooltip, Typography, useMediaQuery, useTheme} from "@mui/material";
import NavigateBeforeIcon from "@mui/icons-material/NavigateBefore";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import {SamplerFilter} from "ris-framework";
import {View2D, View3D} from "../model/View.ts";
import {textureDetails, useSelectedTexture, useTextureStore} from "../store/TextureStore.ts";
import {useViewerStore} from "../store/viewerStore.ts";

// TODO: Fit / 1:1 / zoom controls. The 2D view fits the canvas to the texture (useFramework) and the
// framework exposes only an orbit camera for 3D, so there is no 2D zoom/pan API to bind yet.

const buttonSx = {px: {xs: 0.75, sm: 1}, py: 0.25, fontSize: 12, textTransform: "none"} as const;

/**
 * Compact controls over the canvas: 2D|3D view, Linear|Nearest filter and a mip level stepper.
 * Rendered inside a pointer-events:none overlay; only the toolbar itself takes pointer events.
 */
export function ViewportToolbar() {
    const selected = useSelectedTexture();
    const {mipLevels} = textureDetails(selected?.texture);
    const mipLevel = useTextureStore((store) => store.mipLevel);
    const setMipLevel = useTextureStore((store) => store.setMipLevel);
    const view = useViewerStore((store) => store.view);
    const setView = useViewerStore((store) => store.setView);
    const filter = useViewerStore((store) => store.filter);
    const setFilter = useViewerStore((store) => store.setFilter);

    const theme = useTheme();
    const isDesktop = useMediaQuery(theme.breakpoints.up("md"));

    if (!selected) {
        return null;
    }

    const showMips = view === View2D && mipLevels > 1;

    return (
        <Paper elevation={2} sx={{
            pointerEvents: "auto",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: {xs: 0.5, sm: 1},
            p: 0.5,
            borderRadius: 2,
            opacity: 0.92,
            maxWidth: "100%",
        }}>
            <ToggleButtonGroup exclusive size="small" aria-label="View" value={view}
                               onChange={(_e, next: string | null) => next && setView(next)}>
                <ToggleButton value={View2D} aria-label="2D view" sx={buttonSx}>2D</ToggleButton>
                <ToggleButton value={View3D} aria-label="3D view" sx={buttonSx}>3D</ToggleButton>
            </ToggleButtonGroup>
            <Tooltip title="Sampler filter">
                <ToggleButtonGroup exclusive size="small" aria-label="Filter" value={filter}
                                   onChange={(_e, next: SamplerFilter | null) => next !== null && setFilter(next)}>
                    <ToggleButton value={SamplerFilter.LINEAR} aria-label="Linear filter" sx={buttonSx}>Linear</ToggleButton>
                    <ToggleButton value={SamplerFilter.NEAREST} aria-label="Nearest filter" sx={buttonSx}>Nearest</ToggleButton>
                </ToggleButtonGroup>
            </Tooltip>
            {showMips && isDesktop && (
                <Select size="small" value={mipLevel} aria-label="Mip level"
                        inputProps={{"aria-label": "Mip level"}}
                        onChange={(e) => setMipLevel(Number(e.target.value))}
                        sx={{fontSize: 12, "& .MuiSelect-select": {py: 0.5}}}>
                    {Array.from({length: mipLevels}, (_, i) => {
                        const w = Math.max(1, (selected.texture?.width ?? 0) >> i);
                        const h = Math.max(1, (selected.texture?.height ?? 0) >> i);
                        return <MenuItem key={i} value={i} sx={{fontSize: 13}}>{`Mip ${i} · ${w}×${h}`}</MenuItem>;
                    })}
                </Select>
            )}
            {showMips && !isDesktop && (
                <Box sx={{display: "flex", alignItems: "center"}} role="group" aria-label="Mip level">
                    <IconButton size="small" aria-label="Previous mip level" disabled={mipLevel <= 0}
                                onClick={() => setMipLevel(mipLevel - 1)}>
                        <NavigateBeforeIcon fontSize="small"/>
                    </IconButton>
                    <Typography variant="caption" sx={{minWidth: 56, textAlign: "center"}} aria-live="polite">
                        Mip {mipLevel}/{mipLevels - 1}
                    </Typography>
                    <IconButton size="small" aria-label="Next mip level" disabled={mipLevel >= mipLevels - 1}
                                onClick={() => setMipLevel(mipLevel + 1)}>
                        <NavigateNextIcon fontSize="small"/>
                    </IconButton>
                </Box>
            )}
        </Paper>
    );
}

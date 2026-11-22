import type {MouseEvent} from "react";
import {
    Box,
    Button,
    IconButton,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    Tooltip,
    Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import {arrayLayerCount, formatFileSize, useTextureStore} from "../store/TextureStore.ts";
import {encodingLabel} from "../service/textureInfo.ts";
import type {ITexture2DContainer} from "../model/ITexture2DContainer.ts";

/** "768×512 · BC7_UNORM_BLOCK · 1.20 MiB" */
function secondaryLine(item: ITexture2DContainer): string {
    const parts: string[] = [];
    if (item.texture) {
        parts.push(`${item.texture.size[0]}×${item.texture.size[1]}`);
    }
    parts.push(encodingLabel(item, true));
    const layers = arrayLayerCount(item);
    if (layers > 0) {
        parts.push(`${layers} layers`);
    }
    if (item.fileSize !== undefined) {
        parts.push(formatFileSize(item.fileSize));
    }
    return parts.join(" · ");
}

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const MULTI_SELECT_HINT = `${IS_MAC ? "⌘" : "Ctrl"}-click to add or remove, Shift-click to select a range`;

/**
 * Loaded textures: click to select one, Ctrl/Cmd-click toggles, Shift-click selects a range (for Convert).
 * The active texture (viewport, Inspector) is the last one clicked. The ✕ button removes (keyboard and touch reachable).
 */
export default function TextureList() {
    const textures = useTextureStore((state) => state.textures);
    const selectedId = useTextureStore((state) => state.selectedId);
    const selectedIds = useTextureStore((state) => state.selectedIds);
    const selectTexture = useTextureStore((state) => state.selectTexture);
    const toggleTextureSelection = useTextureStore((state) => state.toggleTextureSelection);
    const selectTextureRange = useTextureStore((state) => state.selectTextureRange);
    const removeTexture = useTextureStore((state) => state.removeTexture);

    const handleClick = (event: MouseEvent, id: string) => {
        if (event.shiftKey) {
            selectTextureRange(id);
        } else if (event.metaKey || event.ctrlKey) {
            toggleTextureSelection(id);
        } else {
            selectTexture(id);
        }
    };

    if (textures.length === 0) {
        return (
            <Typography sx={{p: 2}} variant="body2" color="text.secondary">
                No textures yet. Use Add File or drop PNG, WebP or KTX2 files on the viewport.
            </Typography>
        );
    }

    const multiSelected = selectedIds.length > 1;

    return (
        <>
            {textures.length > 1 && <Box sx={{display: "flex", alignItems: "center", gap: 1, px: 2, py: 0.5, minHeight: 32,
                bgcolor: multiSelected ? "action.selected" : undefined}} aria-live="polite">
                {multiSelected ? (
                    <>
                        <Typography variant="caption" sx={{flex: 1, fontWeight: 500}}>
                            {selectedIds.length} selected
                        </Typography>
                        <Button size="small" sx={{minWidth: 0, py: 0, fontSize: 12, textTransform: "none"}}
                                onClick={() => selectTexture(selectedId)}>
                            Clear
                        </Button>
                    </>
                ) : (
                    <Typography variant="caption" color="text.secondary" noWrap title={MULTI_SELECT_HINT}>
                        {MULTI_SELECT_HINT}
                    </Typography>
                )}
            </Box>}
            <List dense aria-label="Loaded textures" sx={{py: 0}}>
                {textures.map((tex) => (
                    <ListItem
                        key={tex.id}
                        disablePadding
                        secondaryAction={
                            <Tooltip title="Remove">
                                <IconButton edge="end" size="small" aria-label={`Remove ${tex.name}`}
                                            onClick={() => removeTexture(tex.id)}>
                                    <CloseIcon fontSize="small"/>
                                </IconButton>
                            </Tooltip>
                        }
                    >
                        <ListItemButton selected={selectedIds.includes(tex.id)}
                                        onClick={(event) => handleClick(event, tex.id)}
                                        // Keep Shift-click from selecting the item text.
                                        onMouseDown={(event) => event.shiftKey && event.preventDefault()}
                                        aria-pressed={selectedIds.includes(tex.id)}
                                        aria-current={tex.id === selectedId ? "true" : undefined}
                                        sx={{
                                            // The active texture (shown in the viewport) gets an accent bar.
                                            borderLeft: 3,
                                            borderLeftColor: multiSelected && tex.id === selectedId ? "primary.main" : "transparent",
                                        }}>
                            <ListItemText
                                primary={tex.name}
                                secondary={secondaryLine(tex)}
                                slotProps={{
                                    primary: {noWrap: true, title: tex.name},
                                    secondary: {noWrap: true, sx: {fontSize: 12}},
                                }}
                            />
                        </ListItemButton>
                    </ListItem>
                ))}
            </List>
        </>
    );
}

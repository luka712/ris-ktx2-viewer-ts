import {
    IconButton,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    Tooltip,
    Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import {formatFileSize, useTextureStore} from "../store/TextureStore.ts";
import {encodingLabel} from "../service/textureInfo.ts";
import type {ITexture2DContainer} from "../model/ITexture2DContainer.ts";

/** "768×512 · BC7_UNORM_BLOCK · 1.20 MiB" */
function secondaryLine(item: ITexture2DContainer): string {
    const parts: string[] = [];
    if (item.texture) {
        parts.push(`${item.texture.width}×${item.texture.height}`);
    }
    parts.push(encodingLabel(item, true));
    if (item.fileSize !== undefined) {
        parts.push(formatFileSize(item.fileSize));
    }
    return parts.join(" · ");
}

/** Loaded textures: click to select, the ✕ button removes (keyboard and touch reachable). */
export default function TextureList() {
    const textures = useTextureStore((state) => state.textures);
    const selectedId = useTextureStore((state) => state.selectedId);
    const selectTexture = useTextureStore((state) => state.selectTexture);
    const removeTexture = useTextureStore((state) => state.removeTexture);

    if (textures.length === 0) {
        return (
            <Typography sx={{p: 2}} variant="body2" color="text.secondary">
                No textures yet. Use Add File or drop PNG, WebP or KTX2 files on the viewport.
            </Typography>
        );
    }

    return (
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
                    <ListItemButton selected={tex.id === selectedId} onClick={() => selectTexture(tex.id)}
                                    aria-current={tex.id === selectedId ? "true" : undefined}>
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
    );
}

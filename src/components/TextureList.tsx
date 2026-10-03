import {useState} from "react";
import {
    Divider,
    Menu,
    MenuItem,
    Paper,
    Typography,
} from "@mui/material";
import {SimpleTreeView, TreeItem} from "@mui/x-tree-view";
import {useTextureStore} from "../store/TextureStore.ts";

/**
 * List of loaded textures with selection and context-menu remove.
 */
export default function TextureList() {
    const textures = useTextureStore((state) => state.textures);
    const selectedTexture = useTextureStore((state) => state.selectedTexture);
    const setSelectedTexture = useTextureStore((state) => state.setSelectedTexture);
    const removeTexture = useTextureStore((state) => state.removeTexture);

    const [contextMenu, setContextMenu] = useState<{
        mouseX: number;
        mouseY: number;
        itemId: string;
    } | null>(null);

    const listTextures = textures.map((tex, index) => ({
        id: `${tex.name}-${index}`,
        label: `${index + 1}. ${tex.name}`,
        texture: tex,
    }));

    const selectedItemId =
        listTextures.find((item) => item.texture === selectedTexture)?.id ?? null;

    const handleSelectionChange = (
        _event: React.SyntheticEvent | null,
        itemId: string | null,
    ) => {
        if (itemId === null) {
            return;
        }

        const selected = listTextures.find((tex) => tex.id === itemId);
        if (selected) {
            setSelectedTexture(selected.texture);
        }
    };

    const handleContextMenu = (event: React.MouseEvent, itemId: string) => {
        event.preventDefault();
        setContextMenu({
            mouseX: event.clientX,
            mouseY: event.clientY,
            itemId,
        });
    };

    const handleCloseContextMenu = () => setContextMenu(null);

    const handleRemove = () => {
        if (contextMenu === null) {
            return;
        }

        const selected = listTextures.find((tex) => tex.id === contextMenu.itemId);
        if (selected) {
            removeTexture(selected.texture);
        }

        handleCloseContextMenu();
    };

    return (
        <Paper
            elevation={3}
            sx={{
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
            }}
        >
            <Typography sx={{p: 2}} variant="h6">
                Textures
            </Typography>

            <Divider/>

            {listTextures.length === 0 ? (
                <Typography sx={{p: 2, opacity: 0.6}} variant="body2">
                    No textures loaded
                </Typography>
            ) : (
                <SimpleTreeView
                    selectedItems={selectedItemId}
                    onSelectedItemsChange={handleSelectionChange}
                >
                    {listTextures.map((tex) => (
                        <TreeItem
                            key={tex.id}
                            itemId={tex.id}
                            label={tex.label}
                            onContextMenu={(event) => handleContextMenu(event, tex.id)}
                        />
                    ))}
                </SimpleTreeView>
            )}

            <Menu
                open={contextMenu !== null}
                onClose={handleCloseContextMenu}
                anchorReference="anchorPosition"
                anchorPosition={
                    contextMenu !== null
                        ? {top: contextMenu.mouseY, left: contextMenu.mouseX}
                        : undefined
                }
            >
                <MenuItem onClick={handleRemove}>Remove</MenuItem>
            </Menu>
        </Paper>
    );
}

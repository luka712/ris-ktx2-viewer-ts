import AddFileButton from "../components/AddFileButton.tsx";
import TextureList from "../components/TextureList.tsx";
import ConvertDialog from "../dialogs/ConvertDialog.tsx";

/** Sidebar "Files" tab. */
export function TexturesListView() {
    return (
        <>
            <AddFileButton/>
            <TextureList/>
            <ConvertDialog/>
        </>
    );
}

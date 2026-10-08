import AddFileButton from "../components/AddFileButton.tsx";
import TextureList from "../components/TextureList.tsx";
import ConvertButton from "../components/ConvertButton.tsx";

/** Sidebar "Files" tab. */
export function TexturesListView() {
    return (
        <>
            <AddFileButton/>
            <TextureList/>
            <ConvertButton/>
        </>
    );
}

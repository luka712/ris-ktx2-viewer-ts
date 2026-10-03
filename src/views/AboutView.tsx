import {Panel} from "../components/Panel.tsx";
import {TextBlockField} from "../components/fields/TextBlockField.tsx";
import AboutDialog from "../dialogs/AboutDialog.tsx";

const ABOUT_TEXT = "A browser-based KTX2 viewer and converter for inspecting, compressing, and converting GPU textures.";

/** Sidebar "About" tab. */
export function AboutView() {
    return (
        <>
            <Panel>
                <TextBlockField label="About" text={ABOUT_TEXT}/>
            </Panel>
            <AboutDialog/>
        </>
    );
}

import {useState} from "react";
import {Box, createTheme, Paper, Tab, Tabs, ThemeProvider, useMediaQuery} from "@mui/material";
import './App.css'
import {SidePanel} from "./views/SidePanel.tsx";
import {ViewportToolbar} from "./views/ViewportToolbar.tsx";
import TextureList from "./components/TextureList.tsx";
import {ViewportView} from "./views/ViewportView.tsx";
import {InspectorView} from "./views/InspectorView.tsx";
import {HeaderView} from "./views/HeaderView.tsx";
import {FooterView} from "./views/FooterView.tsx";
import {ErrorBoundary} from "./components/ErrorBoundary.tsx";
import {ConvertNotifications} from "./components/ConvertNotifications.tsx";
import Dropzone from "./components/Dropzone.tsx";

/** Keys shared with the inline script in index.html that applies the scheme before first paint. */
export const THEME_MODE_STORAGE_KEY = "ris-ktx2-viewer.themeMode";
const COLOR_SCHEME_STORAGE_KEY = "ris-ktx2-viewer.colorScheme";

const theme = createTheme({
    cssVariables: {colorSchemeSelector: "data"},
    colorSchemes: {light: true, dark: true},
});

const LEFT_PANEL_WIDTH = 280;
const RIGHT_PANEL_WIDTH = 320;
const PANELS_STORAGE_KEY = "ris-ktx2-viewer.panels";

function loadPanels(): { left: boolean; right: boolean } {
    try {
        return {left: true, right: true, ...JSON.parse(localStorage.getItem(PANELS_STORAGE_KEY) ?? "{}")};
    } catch {
        return {left: true, right: true};
    }
}

/** Canvas with the drop zone and the toolbar overlay (the overlay only takes pointer events on the toolbar). */
function Viewport() {
    return (
        <Paper elevation={1} sx={{position: "relative", height: "100%", borderRadius: 2, overflow: "hidden"}}>
            <Dropzone>
                <ErrorBoundary title="The viewport crashed">
                    <ViewportView/>
                </ErrorBoundary>
            </Dropzone>
            <Box sx={{position: "absolute", top: 8, left: 8, right: 8, display: "flex",
                justifyContent: "center", pointerEvents: "none", zIndex: 2}}>
                <ViewportToolbar/>
            </Box>
        </Paper>
    );
}

/** md and up: Textures | viewport | Inspector, side panels collapsible. */
function DesktopLayout() {
    const [panels, setPanels] = useState(loadPanels);
    const toggle = (side: "left" | "right") => setPanels((current) => {
        const next = {...current, [side]: !current[side]};
        localStorage.setItem(PANELS_STORAGE_KEY, JSON.stringify(next));
        return next;
    });

    return (
        <Box sx={{flex: 1, minHeight: 0, display: "flex", gap: 1}}>
            <SidePanel title="Textures" side="left" open={panels.left} onToggle={() => toggle("left")}
                       width={LEFT_PANEL_WIDTH}>
                <TextureList/>
            </SidePanel>
            <Box sx={{flex: 1, minWidth: 0}}>
                <Viewport/>
            </Box>
            <SidePanel title="Inspector" side="right" open={panels.right} onToggle={() => toggle("right")}
                       width={RIGHT_PANEL_WIDTH}>
                <InspectorView/>
            </SidePanel>
        </Box>
    );
}

/** Below md: canvas at ~60vh, then Textures | Inspector tabs; the page scrolls. */
function MobileLayout() {
    const [tab, setTab] = useState(0);
    return (
        <Box sx={{flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 1}}>
            <Box sx={{height: "60vh", flexShrink: 0}}>
                <Viewport/>
            </Box>
            <Paper elevation={1} sx={{borderRadius: 2, flexShrink: 0}}>
                <Tabs value={tab} onChange={(_e, value: number) => setTab(value)} variant="fullWidth"
                      aria-label="Panels">
                    <Tab label="Textures" id="tab-textures" aria-controls="panel-textures"/>
                    <Tab label="Inspector" id="tab-inspector" aria-controls="panel-inspector"/>
                </Tabs>
                <Box role="tabpanel" id={tab === 0 ? "panel-textures" : "panel-inspector"}
                     aria-labelledby={tab === 0 ? "tab-textures" : "tab-inspector"}>
                    {tab === 0 ? <TextureList/> : <InspectorView/>}
                </Box>
            </Paper>
        </Box>
    );
}

function Layout() {
    const isDesktop = useMediaQuery(theme.breakpoints.up("md"), {noSsr: true});
    return isDesktop ? <DesktopLayout/> : <MobileLayout/>;
}

/** Page: header, Textures | viewport | Inspector, one-line status bar. */
function App() {
    return (
        <ThemeProvider
            theme={theme}
            defaultMode="system"
            modeStorageKey={THEME_MODE_STORAGE_KEY}
            colorSchemeStorageKey={COLOR_SCHEME_STORAGE_KEY}
        >
            <ErrorBoundary title="Something went wrong">
                <Box className="app" sx={{height: "100vh", display: "flex", flexDirection: "column", gap: 1, p: 1, boxSizing: "border-box"}}>
                    <HeaderView/>
                    <Layout/>
                    <FooterView/>
                </Box>
                <ConvertNotifications/>
            </ErrorBoundary>
        </ThemeProvider>
    );
}

export default App;

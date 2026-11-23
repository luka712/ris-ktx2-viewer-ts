import {useEffect} from "react";
import {Box, createTheme, ThemeProvider} from "@mui/material";
import './App.css'
import {HeaderView} from "./features/layout/HeaderView.tsx";
import {FooterView} from "./features/layout/FooterView.tsx";
import {AppLayout} from "./features/layout/AppLayout.tsx";
import {ErrorBoundary} from "./components/ui/ErrorBoundary.tsx";
import {ConvertNotifications} from "./features/convert/ConvertNotifications.tsx";
import {ViewerNotifications} from "./features/layout/ViewerNotifications.tsx";
import {useViewerStore} from "./store/viewerStore.ts";

/** Keys shared with the inline script in index.html that applies the scheme before first paint. */
export const THEME_MODE_STORAGE_KEY = "ris-ktx2-viewer.themeMode";
const COLOR_SCHEME_STORAGE_KEY = "ris-ktx2-viewer.colorScheme";

const theme = createTheme({
    cssVariables: {colorSchemeSelector: "data"},
    colorSchemes: {light: true, dark: true},
});

/** Page: header, Textures | viewport | Inspector, one-line status bar. */
function App() {
    // WebGPU support decides whether the backend switch offers it.
    useEffect(() => {
        void useViewerStore.getState().probeWebGpuAsync();
    }, []);

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
                    <AppLayout/>
                    <FooterView/>
                </Box>
                <ConvertNotifications/>
                <ViewerNotifications/>
            </ErrorBoundary>
        </ThemeProvider>
    );
}

export default App;

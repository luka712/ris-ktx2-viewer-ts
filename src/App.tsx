import {Box, createTheme, Grid, Paper, Stack, ThemeProvider} from "@mui/material";
import './App.css'
import {SidebarView} from "./views/SidebarView.tsx";
import {ViewportView} from "./views/ViewportView.tsx";
import {PropertiesView} from "./views/PropertiesView.tsx";
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

/**
 * Page layout: sidebar | viewport | properties, footer below.
 * Stacks into one scrollable column below the md breakpoint.
 */
function App() {
    return (
        <ThemeProvider
            theme={theme}
            defaultMode="system"
            modeStorageKey={THEME_MODE_STORAGE_KEY}
            colorSchemeStorageKey={COLOR_SCHEME_STORAGE_KEY}
        >
            <ErrorBoundary title="Something went wrong">
                <div className="app" style={{height: '100vh', display: 'flex', flexDirection: 'column'}}>
                        <HeaderView/>
                    <Paper sx={{flex: 1, minHeight: 0, overflowY: {xs: 'auto', md: 'hidden'}, overflowX: 'hidden'}}>
                        <Box sx={{overflowY: 'auto', height: '100%'}}>
                            <Stack direction="column">
                                <Grid
                                    container
                                    spacing={2}
                                    sx={{height: {xs: 'auto', md: '100%'}, minHeight: {md: '100%'}}}
                                >
                                    <Grid size={{xs: 12, sm: 12, md: 3}}>
                                        <SidebarView/>
                                    </Grid>
                                    <Grid size={{xs: 12, sm: 12, md: 6}}>
                                        <Dropzone>
                                            <ErrorBoundary title="The viewport crashed">
                                                <ViewportView/>
                                            </ErrorBoundary>
                                        </Dropzone>
                                    </Grid>
                                    <Grid size={{xs: 12, sm: 12, md: 3}}>
                                        <Box sx={{
                                            paddingTop: 1,
                                            paddingBottom: 1,
                                            marginRight: 1,
                                            marginLeft: 1,
                                            marginTop: 2
                                        }}>
                                            <PropertiesView/>
                                        </Box>
                                    </Grid>
                                </Grid>

                                <Grid size={12} sx={{mt: 'auto', paddingTop: 1, paddingBottom: 1, px: {xs: 1, sm: 1}}}>
                                    <FooterView/>
                                </Grid>
                            </Stack>
                        </Box>
                    </Paper>
                </div>
                <ConvertNotifications/>
            </ErrorBoundary>
        </ThemeProvider>
    );
}

export default App;

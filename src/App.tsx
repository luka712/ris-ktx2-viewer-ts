import {Box, createTheme, Grid, Paper, Stack, ThemeProvider} from "@mui/material";
import './App.css'
import {SidebarView} from "./views/SidebarView.tsx";
import {ViewportView} from "./views/ViewportView.tsx";
import {PropertiesView} from "./views/PropertiesView.tsx";
import {FooterView} from "./views/FooterView.tsx";

const theme = createTheme({cssVariables: true, palette: {mode: "dark"}});

/**
 * Page layout: sidebar | viewport | properties, footer below.
 * Stacks into one scrollable column below the md breakpoint.
 */
function App() {
    return (
        <ThemeProvider theme={theme}>
            <div className="app" style={{height: '100vh', display: 'flex', flexDirection: 'column'}}>
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
                                    <ViewportView/>
                                </Grid>
                                <Grid size={{xs: 12, sm: 12, md: 3}}>
                                    <Box sx={{paddingTop: 2, paddingBottom: 2, marginRight: 2, marginLeft: 2, marginTop: 2}}>
                                        <PropertiesView/>
                                    </Box>
                                </Grid>
                            </Grid>

                            <Grid size={12} sx={{mt: 'auto', paddingTop: 2, paddingBottom: 2, px: {xs: 1, sm: 1}}}>
                                <FooterView/>
                            </Grid>
                        </Stack>
                    </Box>
                </Paper>
            </div>
        </ThemeProvider>
    );
}

export default App;

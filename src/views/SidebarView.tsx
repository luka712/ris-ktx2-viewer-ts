import {useState} from "react";
import {Box, Stack, Tab, Tabs} from "@mui/material";
import {TexturesListView} from "./TexturesListView.tsx";
import {GpuPropertiesView} from "./GpuPropertiesView.tsx";
import {AboutView} from "./AboutView.tsx";

const TABS = [
    {label: "Files", Content: TexturesListView},
    {label: "GPU Info", Content: GpuPropertiesView},
    {label: "About", Content: AboutView},
];

/** Left column: tab bar and the active tab's content. */
export function SidebarView() {
    const [tab, setTab] = useState(0);
    const {Content} = TABS[tab];

    return (
        <Box>
            <Tabs
                value={tab}
                aria-label="Sidebar"
                sx={{paddingTop: 2, paddingBottom: 2}}
                onChange={(_event, newValue: number) => setTab(newValue)}
                variant="scrollable"
                allowScrollButtonsMobile
            >
                {TABS.map(({label}) => <Tab key={label} label={label}/>)}
            </Tabs>
            <Stack direction="column" spacing={2} sx={{marginLeft: 2, marginRight: 2}}>
                <Content/>
            </Stack>
        </Box>
    );
}

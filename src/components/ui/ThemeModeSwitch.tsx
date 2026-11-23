import {Box, ToggleButton, ToggleButtonGroup, Tooltip} from "@mui/material";
import {useColorScheme} from "@mui/material/styles";
import BrightnessAutoIcon from "@mui/icons-material/BrightnessAuto";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";

type Mode = "system" | "light" | "dark";

const OPTIONS: { value: Mode; label: string; Icon: typeof LightModeIcon }[] = [
    {value: "system", label: "Auto", Icon: BrightnessAutoIcon},
    {value: "light", label: "Light", Icon: LightModeIcon},
    {value: "dark", label: "Dark", Icon: DarkModeIcon},
];

/** Segmented Auto / Light / Dark switch. MUI persists the mode in localStorage. */
export function ThemeModeSwitch() {
    const {mode, setMode} = useColorScheme();

    return (
        <ToggleButtonGroup
            exclusive
            size="small"
            aria-label="Theme"
            // mode is undefined until MUI has read the stored value.
            value={mode ?? "system"}
            onChange={(_event, next: Mode | null) => {
                // Clicking the active option returns null; keep a value selected.
                if (next) {
                    setMode(next);
                }
            }}
        >
            {OPTIONS.map(({value, label, Icon}) => (
                <Tooltip key={value} title={label}>
                    <ToggleButton
                        value={value}
                        aria-label={label}
                        sx={{px: {xs: 0.75, sm: 1.25}, py: 0.25, gap: 0.5, textTransform: "none"}}
                    >
                        <Icon sx={{fontSize: 16}}/>
                        <Box component="span" sx={{display: {xs: "none", sm: "inline"}, fontSize: 12}}>
                            {label}
                        </Box>
                    </ToggleButton>
                </Tooltip>
            ))}
        </ToggleButtonGroup>
    );
}

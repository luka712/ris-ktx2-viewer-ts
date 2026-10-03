import {Paper} from "@mui/material";
import type {ReactNode} from "react";

/** Elevated paper with 20px rounded corners used for the side panels. */
export function Panel({children}: { children: ReactNode }) {
    return (
        <Paper elevation={3} sx={{borderRadius: "20px"}}>
            {children}
        </Paper>
    );
}

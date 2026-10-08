import {Component, type ReactNode} from "react";
import {Alert, AlertTitle, Box, Button} from "@mui/material";

interface ErrorBoundaryProps {
    children: ReactNode;
    /** Heading shown above the error message. */
    title: string;
}

interface ErrorBoundaryState {
    error: Error | null;
}

/**
 * Catches render / effect errors below it and shows an error panel with a retry button
 * instead of unmounting the whole app. Errors are logged via createRoot's onCaughtError.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = {error: null};

    static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
        return {error: error instanceof Error ? error : new Error(String(error))};
    }

    private readonly reset = () => this.setState({error: null});

    render() {
        const {error} = this.state;
        if (!error) {
            return this.props.children;
        }

        return (
            <Box sx={{p: 2}}>
                <Alert
                    severity="error"
                    action={<Button color="inherit" size="small" onClick={this.reset}>Retry</Button>}
                >
                    <AlertTitle>{this.props.title}</AlertTitle>
                    {error.message}
                </Alert>
            </Box>
        );
    }
}

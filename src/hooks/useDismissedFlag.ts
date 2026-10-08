import {useCallback, useState} from "react";

function readFlag(key: string): boolean {
    try {
        return window.localStorage.getItem(key) === "true";
    } catch {
        return false;
    }
}

/**
 * Persistent "dismissed" flag backed by localStorage. Read once on mount.
 * If storage is unavailable, dismissal only lasts for the current session.
 */
export function useDismissedFlag(key: string): [boolean, () => void] {
    const [dismissed, setDismissed] = useState<boolean>(() => readFlag(key));
    const dismiss = useCallback(() => {
        setDismissed(true);
        try {
            window.localStorage.setItem(key, "true");
        } catch {
            // Storage blocked (e.g. private mode): keep session-only dismissal.
        }
    }, [key]);
    return [dismissed, dismiss];
}

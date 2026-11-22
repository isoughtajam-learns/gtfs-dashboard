import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Box, Dialog, IconButton, Typography } from "@mui/material";
import { useAuth } from "./AuthContext.tsx";

function CloseIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
    );
}

const fieldSx = {
    width: "100%",
    boxSizing: "border-box" as const,
    fontFamily: "var(--font-body)",
    fontSize: "0.95rem",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid var(--hairline)",
    backgroundColor: "var(--surface)",
    color: "var(--ink)",
    outline: "none",
};
const submitButtonSx = {
    width: "100%",
    fontFamily: "var(--font-display)",
    fontWeight: 600,
    fontSize: "0.95rem",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "var(--coral)",
    color: "#fff",
    cursor: "pointer",
    "&:disabled": { opacity: 0.6, cursor: "default" },
};
const switchModeButtonSx = {
    fontFamily: "var(--font-body)",
    fontSize: "0.85rem",
    color: "var(--coral)",
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
    textDecoration: "underline",
};

type AuthDialogProps = {
    open: boolean;
    onClose: () => void;
};

// Phase 4 (.claude/plans/development.md): one Dialog toggling between
// sign-in/sign-up mode, styled like ServiceAlertsModal.tsx. No routing -
// Header.tsx opens this directly rather than navigating to a page, since
// the whole interaction is "give me an email+password and get back to
// what you were doing."
export default function AuthDialog({ open, onClose }: AuthDialogProps) {
    const { login, signup } = useAuth();
    const [mode, setMode] = useState<"login" | "signup">("login");
    const [email, setEmail] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    // Identifies each submit attempt so its .then/.catch can tell, once
    // the request resolves, whether it's still the CURRENT attempt - not
    // just whether the dialog is closed. A boolean "closed" flag isn't
    // enough: close -> reopen -> resubmit resets it to false again, so a
    // still-pending FIRST request's resolution would be mistaken for the
    // second attempt's own, clobbering its state (reset()+onClose() or a
    // stale error) instead of being ignored.
    const attemptRef = useRef(0);

    const reset = () => {
        setEmail("");
        setUsername("");
        setPassword("");
        setError(null);
        setSubmitting(false);
    };

    const handleClose = () => {
        attemptRef.current += 1;
        reset();
        onClose();
    };

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        const attemptId = (attemptRef.current += 1);
        setError(null);
        setSubmitting(true);
        // Sign-in uses username, not email - see models.AppUser's own
        // docstring (gtfs-realtime repo) for why.
        const action = mode === "login"
            ? login(username, password)
            : signup(email, username, password);
        action
            .then(() => {
                if (attemptRef.current !== attemptId) return;
                reset();
                onClose();
            })
            .catch((err: unknown) => {
                if (attemptRef.current !== attemptId) return;
                setSubmitting(false);
                setError(err instanceof Error ? err.message : "Something went wrong");
            });
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="xs"
            fullWidth
            slotProps={{
                paper: {
                    sx: {
                        backgroundColor: "var(--surface-raised)",
                        border: "1px solid var(--hairline)",
                        borderRadius: "var(--radius)",
                        color: "var(--ink)",
                        boxShadow: "none",
                    },
                },
            }}
        >
            <Box sx={{ position: "relative", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2, px: 2, py: 1.5, borderBottom: "1px solid var(--hairline)" }}>
                <Typography sx={{ fontFamily: "var(--font-body)", fontWeight: 700, fontSize: "1.3rem" }}>
                    { mode === "login" ? "Sign in" : "Create account" }
                </Typography>
                <IconButton onClick={handleClose} aria-label="Close" sx={{ color: "var(--coral)" }}>
                    <CloseIcon />
                </IconButton>
            </Box>
            <Box component="form" onSubmit={handleSubmit} sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5 }}>
                { mode === "signup" && (
                    <Box
                        component="input"
                        type="email"
                        required
                        autoFocus
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        sx={fieldSx}
                    />
                )}
                <Box
                    component="input"
                    type="text"
                    required
                    autoFocus={mode === "login"}
                    autoComplete="username"
                    minLength={3}
                    maxLength={30}
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    sx={fieldSx}
                />
                <Box
                    component="input"
                    type="password"
                    required
                    // Signup-only - the backend's LoginRequest deliberately
                    // has no minimum (models.py), so an existing account
                    // with a shorter password (from before this minimum was
                    // added) can still log in. Enforcing it here regardless
                    // of mode would block that login client-side, with no
                    // change-password flow to ever fix such an account.
                    minLength={mode === "signup" ? 8 : undefined}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    sx={fieldSx}
                />
                { error && (
                    <Typography sx={{ fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "var(--coral-ink)" }}>
                        { error }
                    </Typography>
                )}
                <Box component="button" type="submit" disabled={submitting} sx={submitButtonSx}>
                    { submitting ? "Please wait…" : mode === "login" ? "Sign in" : "Create account" }
                </Box>
                <Box sx={{ textAlign: "center", fontFamily: "var(--font-body)", fontSize: "0.85rem", color: "var(--ink-secondary)" }}>
                    { mode === "login" ? "New here? " : "Already have an account? " }
                    <Box
                        component="button"
                        type="button"
                        onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(null); }}
                        sx={switchModeButtonSx}
                    >
                        { mode === "login" ? "Create an account" : "Sign in" }
                    </Box>
                </Box>
            </Box>
        </Dialog>
    );
}

// Phase 4 (.claude/plans/development.md): typed fetch helpers for the
// backend's /auth/* endpoints (gtfs-realtime's src/main.py). All relative
// URLs through the existing /api proxy (see vite.config.ts), all with
// credentials: "include" so the httponly session cookie the backend sets
// rides along on every request, including cross-port local dev.

export type AuthUser = {
    email: string;
};

class AuthError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

async function parseAuthResponse(res: Response): Promise<AuthUser> {
    if (!res.ok) {
        const body: unknown = await res.json().catch(() => null);
        const detail =
            body && typeof body === "object" && "detail" in body
                ? String((body as { detail: unknown }).detail)
                : `Request failed: ${res.status}`;
        throw new AuthError(detail, res.status);
    }
    return (await res.json()) as AuthUser;
}

export async function signup(email: string, password: string): Promise<AuthUser> {
    const res = await fetch("/api/auth/signup", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });
    return parseAuthResponse(res);
}

export async function login(email: string, password: string): Promise<AuthUser> {
    const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });
    return parseAuthResponse(res);
}

export async function logout(): Promise<void> {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
}

// Returns null for "not logged in" (401) rather than throwing - this is
// the normal, expected state on first load for most visitors, not an
// error worth logging.
export async function fetchMe(): Promise<AuthUser | null> {
    const res = await fetch("/api/auth/me", { credentials: "include" });
    if (res.status === 401) return null;
    if (!res.ok) throw new Error(`Failed to fetch current user: ${res.status}`);
    return (await res.json()) as AuthUser;
}

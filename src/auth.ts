// Phase 4 (.claude/plans/development.md): typed fetch helpers for the
// backend's /auth/* endpoints (gtfs-realtime's src/main.py). All relative
// URLs through the existing /api proxy (see vite.config.ts), all with
// credentials: "include" so the httponly session cookie the backend sets
// rides along on every request, including cross-port local dev.

export type AuthUser = {
    email: string;
    username: string;
};

class AuthError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

// FastAPI's own 409/401 handlers in main.py send detail as a plain
// string, but a Pydantic validation failure (422 - e.g. this PR's new
// password-length/username-charset checks in models.py) sends it as an
// array of {loc, msg, type} objects instead - String(detail) on that
// shape renders as an unhelpful "[object Object]".
function extractErrorDetail(body: unknown, fallback: string): string {
    if (!body || typeof body !== "object" || !("detail" in body)) return fallback;
    const detail = (body as { detail: unknown }).detail;
    if (Array.isArray(detail)) {
        const messages = detail
            .map((item) =>
                item && typeof item === "object" && "msg" in item
                    ? String((item as { msg: unknown }).msg)
                    : null,
            )
            .filter((msg): msg is string => msg !== null);
        return messages.length > 0 ? messages.join("; ") : fallback;
    }
    return String(detail);
}

async function parseAuthResponse(res: Response): Promise<AuthUser> {
    if (!res.ok) {
        const body: unknown = await res.json().catch(() => null);
        throw new AuthError(extractErrorDetail(body, `Request failed: ${res.status}`), res.status);
    }
    return (await res.json()) as AuthUser;
}

export async function signup(
    email: string,
    username: string,
    password: string,
): Promise<AuthUser> {
    const res = await fetch("/api/auth/signup", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password }),
    });
    return parseAuthResponse(res);
}

// Sign-in uses username, not email - see models.AppUser's own docstring
// (gtfs-realtime repo) for why.
export async function login(username: string, password: string): Promise<AuthUser> {
    const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
    });
    return parseAuthResponse(res);
}

export async function logout(): Promise<void> {
    const res = await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    // fetch() only rejects on a network-level failure, never on a non-2xx
    // status - without this check a 5xx "succeeds" from this function's
    // point of view, and AuthContext's logout() would clear local auth
    // state even though the session cookie was never actually cleared
    // server-side.
    if (!res.ok) {
        throw new AuthError(`Failed to log out: ${res.status}`, res.status);
    }
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

// Shared by auth.ts and savedStations.ts, whose own HTTP error handling
// was previously duplicated near-identically across both files (same
// status-carrying Error subclass, same detail-array-vs-string parsing).

export class HttpError extends Error {
    status: number;
    constructor(message: string, status: number) {
        super(message);
        this.status = status;
    }
}

// FastAPI's own 404/409/401 handlers send detail as a plain string, but a
// Pydantic validation failure (422 - e.g. a field outside its declared
// range) sends it as an array of {loc, msg, type} objects instead -
// String(detail) on that shape renders as an unhelpful "[object Object]".
export function extractErrorDetail(body: unknown, fallback: string): string {
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

// Classic three-line funnel: active sort/filter state is conveyed by the
// caller's own color (e.g. an IconButton's `color`), not by the glyph
// itself.
export function FilterIcon() {
    return (
        <svg width="12" height="10" viewBox="0 0 12 10" fill="none" aria-hidden="true">
            <line x1="1" y1="1" x2="11" y2="1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <line x1="2.5" y1="5" x2="9.5" y2="5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            <line x1="4.5" y1="9" x2="7.5" y2="9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
    );
}

// Chevron for a collapsible toggle - flips to point up (via the caller's
// rotate transform) once expanded, the standard disclosure-widget affordance.
export function ChevronDownIcon() {
    return (
        <svg width="12" height="8" viewBox="0 0 12 8" fill="none" aria-hidden="true">
            <path d="M1 1.5 6 6.5 11 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

// Phase 4 (.claude/plans/development.md): save/unsave a station. Filled
// when saved, outline otherwise - same filled-vs-outline convention
// Header.tsx's BellIcon already uses for "something to show" vs. not.
export function StarIcon({ filled }: { filled: boolean }) {
    return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
                d="M8 1.5 9.8 5.6l4.5.4-3.4 3 1 4.4L8 11.1l-3.9 2.3 1-4.4-3.4-3 4.5-.4Z"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinejoin="round"
                fill={filled ? "currentColor" : "none"}
            />
        </svg>
    );
}

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Box } from "@mui/material";

// Matches MUI's default `sm` breakpoint (600px), same as every other
// responsive prop in this app - keeps the title's own size in step with
// whatever breakpoint the rest of the header is reacting to.
const SM_UP_QUERY = "(min-width: 600px)";

function useIsSmUp(): boolean {
    const [isSmUp, setIsSmUp] = useState(() => window.matchMedia(SM_UP_QUERY).matches);
    useEffect(() => {
        const mql = window.matchMedia(SM_UP_QUERY);
        const listener = () => setIsSmUp(mql.matches);
        mql.addEventListener("change", listener);
        return () => mql.removeEventListener("change", listener);
    }, []);
    return isSmUp;
}

type SplitFlapTitleProps = {
    textA: string;
    textB: string;
    fontFamilyA?: string;
    fontFamilyB?: string;
    colorA?: string;
    colorB?: string;
    // Asymmetric dwell times: how long each face stays up before flipping to
    // the other. Not a single fixed cadence - textA and textB can (and here,
    // do) spend different amounts of time showing.
    textADurationMs?: number;
    textBDurationMs?: number;
    flipDurationMs?: number;
};

// Mimics a mechanical split-flap (Solari) departure sign: the whole title
// flips down as one card, alternating between two fixed messages forever.
export default function SplitFlapTitle({
    textA,
    textB,
    fontFamilyA,
    fontFamilyB,
    colorA,
    colorB,
    textADurationMs = 4200,
    textBDurationMs = 800,
    flipDurationMs = 600,
}: SplitFlapTitleProps) {
    const [flipped, setFlipped] = useState(false);
    const containerRef = useRef<HTMLSpanElement>(null);
    const [width, setWidth] = useState<number | null>(null);
    const isSmUp = useIsSmUp();
    // These are the literal sizes actually rendered below - measurement has
    // to use the exact same values, or the measured container ends up
    // narrower than what's painted and the overflow spills into whatever
    // sits next in the header (previously: fixed at "2rem"/"0.875rem"
    // regardless of viewport, so at narrow widths the rendered text was far
    // wider than its measured box and visually overlapped the transit
    // system dropdown next to it).
    const fontSizeA = isSmUp ? "2rem" : "1.3rem";
    const fontSizeB = isSmUp ? "0.875rem" : "0.7rem";

    useEffect(() => {
        // Re-armed after every flip (not a fixed-cadence setInterval), since
        // the two faces dwell for different lengths of time: whichever face
        // is showing right now determines how long until the next flip.
        const duration = flipped ? textBDurationMs : textADurationMs;
        const id = setTimeout(() => setFlipped((f) => !f), duration);
        return () => clearTimeout(id);
    }, [flipped, textADurationMs, textBDurationMs]);

    // The two faces are different strings (and possibly different fonts) at
    // different natural widths; measure both up front so the card has a
    // fixed width and never reflows mid-flip. Re-measured once webfonts
    // finish loading, since canvas falls back to system-font metrics until
    // then.
    useLayoutEffect(() => {
        const el = containerRef.current;
        const ctx = document.createElement("canvas").getContext("2d");
        if (!el || !ctx) return;

        const computed = getComputedStyle(el);
        // Font weight/size here must match what's actually rendered below
        // (bold + fontSizeA for face A; ambient weight + fontSizeB for face
        // B) rather than the container's own ambient style, or the measured
        // width won't match the painted glyphs.
        const fontA = `700 ${fontSizeA} ${fontFamilyA ?? computed.fontFamily}`;
        const fontB = `${computed.fontStyle} ${computed.fontWeight} ${fontSizeB} ${fontFamilyB ?? computed.fontFamily}`;

        const measure = () => {
            ctx.font = fontA;
            const widthA = ctx.measureText(textA).width;
            ctx.font = fontB;
            const widthB = ctx.measureText(textB).width;
            setWidth(Math.ceil(Math.max(widthA, widthB)) + 2);
        };

        measure();
        void document.fonts?.ready.then(measure);
    }, [textA, textB, fontFamilyA, fontFamilyB, fontSizeA, fontSizeB]);

    return (
        <Box
            component="span"
            ref={containerRef}
            sx={{
                display: "inline-block",
                width: width ? `${width}px` : "auto",
                height: "1.8em",
                perspective: "600px",
                verticalAlign: "top",
            }}
        >
            <Box
                component="span"
                // Announced as one atomic string; the faces below are
                // decorative, so a screen reader shouldn't read every flip.
                role="text"
                aria-label={flipped ? textB : textA}
                sx={{
                    position: "relative",
                    display: "block",
                    width: "100%",
                    height: "100%",
                    transformStyle: "preserve-3d",
                    transform: flipped ? "rotateX(-180deg)" : "rotateX(0deg)",
                    transition: `transform ${flipDurationMs}ms cubic-bezier(0.6, 0, 0.4, 1)`,
                    "@media (prefers-reduced-motion: reduce)": {
                        transition: "none",
                    },
                }}
            >
                <Box
                    component="span"
                    aria-hidden="true"
                    sx={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-start",
                        backfaceVisibility: "hidden",
                        whiteSpace: "pre",
                        fontFamily: fontFamilyA,
                        color: colorA,
                        fontWeight: "700",
                        fontSynthesis: "weight",
                        fontSize: fontSizeA,
                    }}
                >
                    {textA}
                </Box>
                <Box
                    component="span"
                    aria-hidden="true"
                    sx={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-start",
                        backfaceVisibility: "hidden",
                        transform: "rotateX(180deg)",
                        whiteSpace: "pre",
                        fontFamily: fontFamilyB,
                        color: colorB,
                        fontSize: fontSizeB,
                    }}
                >
                    {textB}
                </Box>
            </Box>
        </Box>
    );
}

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Box } from "@mui/material";

type SplitFlapTitleProps = {
    textA: string;
    textB: string;
    fontFamilyA?: string;
    fontFamilyB?: string;
    intervalMs?: number;
    flipDurationMs?: number;
};

// Mimics a mechanical split-flap (Solari) departure sign: the whole title
// flips down as one card, alternating between two fixed messages forever.
export default function SplitFlapTitle({
    textA,
    textB,
    fontFamilyA,
    fontFamilyB,
    intervalMs = 3500,
    flipDurationMs = 600,
}: SplitFlapTitleProps) {
    const [flipped, setFlipped] = useState(false);
    const containerRef = useRef<HTMLSpanElement>(null);
    const [width, setWidth] = useState<number | null>(null);

    useEffect(() => {
        const id = setInterval(() => setFlipped((f) => !f), intervalMs);
        return () => clearInterval(id);
    }, [intervalMs]);

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
        const fontA = `${computed.fontStyle} ${computed.fontWeight} ${computed.fontSize} ${fontFamilyA ?? computed.fontFamily}`;
        const fontB = `${computed.fontStyle} ${computed.fontWeight} ${computed.fontSize} ${fontFamilyB ?? computed.fontFamily}`;

        const measure = () => {
            ctx.font = fontA;
            const widthA = ctx.measureText(textA).width;
            ctx.font = fontB;
            const widthB = ctx.measureText(textB).width;
            setWidth(Math.ceil(Math.max(widthA, widthB)) + 2);
        };

        measure();
        void document.fonts?.ready.then(measure);
    }, [textA, textB, fontFamilyA, fontFamilyB]);

    return (
        <Box
            component="span"
            ref={containerRef}
            sx={{
                display: "inline-block",
                width: width ? `${width}px` : "auto",
                height: "1.2em",
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
                    sx={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", whiteSpace: "pre", fontFamily: fontFamilyA }}
                >
                    {textA}
                </Box>
                <Box
                    component="span"
                    aria-hidden="true"
                    sx={{
                        position: "absolute",
                        inset: 0,
                        backfaceVisibility: "hidden",
                        transform: "rotateX(180deg)",
                        whiteSpace: "pre",
                        fontFamily: fontFamilyB,
                    }}
                >
                    {textB}
                </Box>
            </Box>
        </Box>
    );
}

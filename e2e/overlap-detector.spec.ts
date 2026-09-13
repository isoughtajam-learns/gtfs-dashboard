import { test, expect } from "@playwright/test";
import { findOverlappingText } from "./utils/overlap";

// Proves the detector itself works, against fixture HTML rather than the
// app - without this, a bug that made findOverlappingText always return []
// would let every real check below pass for the wrong reason.
test.describe("findOverlappingText", () => {
    test("flags two absolutely-positioned text blocks stacked on top of each other", async ({ page }) => {
        await page.setContent(`
            <div style="position:relative; font: 16px/1.2 sans-serif;">
                <div style="position:absolute; top:0; left:0;">Overlapping label one</div>
                <div style="position:absolute; top:5px; left:5px;">Overlapping label two</div>
            </div>
        `);
        const overlaps = await findOverlappingText(page);
        expect(overlaps.length).toBeGreaterThan(0);
    });

    test("does not flag normally-flowed, non-overlapping text", async ({ page }) => {
        await page.setContent(`
            <div style="font: 16px/1.2 sans-serif;">
                <p>First paragraph of ordinary text.</p>
                <p>Second paragraph of ordinary text.</p>
            </div>
        `);
        const overlaps = await findOverlappingText(page);
        expect(overlaps).toEqual([]);
    });

    test("ignores off-screen text", async ({ page }) => {
        await page.setContent(`
            <div style="position:relative; font: 16px/1.2 sans-serif;">
                <div style="position:absolute; left:-9999px;">Off-screen label one</div>
                <div style="position:absolute; left:-9998px;">Off-screen label two</div>
            </div>
        `);
        const overlaps = await findOverlappingText(page);
        expect(overlaps).toEqual([]);
    });

    // aria-hidden is a screen-reader semantic, not a paint signal - content
    // can be aria-hidden and still fully visible (e.g. this app's own
    // SplitFlapTitle, whose real accessible label lives on an ancestor's
    // aria-label instead). A blanket aria-hidden exemption would blind the
    // detector to exactly that kind of overlap.
    test("still flags aria-hidden text that visually overlaps something else", async ({ page }) => {
        await page.setContent(`
            <div style="position:relative; font: 16px/1.2 sans-serif;">
                <div style="position:absolute; top:0; left:0;" aria-hidden="true">Hidden but visible text</div>
                <div style="position:absolute; top:0; left:0;">Overlapping visible text</div>
            </div>
        `);
        const overlaps = await findOverlappingText(page);
        expect(overlaps.length).toBeGreaterThan(0);
    });

    // MUI's Modal/Dialog marks the app's #root mount point
    // aria-hidden="true" while open, to inert the whole background page
    // behind an opaque dialog - that background text is still in the DOM
    // with real geometry, but is actually painted underneath the dialog's
    // solid paper, not visible to a user, so it must not count as
    // overlapping the dialog's own text.
    test("ignores background text inerted behind an open dialog (#root aria-hidden)", async ({ page }) => {
        await page.setContent(`
            <div id="root" aria-hidden="true">
                <div style="position:fixed; top:0; left:0;">Background page text</div>
            </div>
            <div role="dialog" style="position:fixed; top:0; left:0; background:white;">Dialog text</div>
        `);
        const overlaps = await findOverlappingText(page);
        expect(overlaps).toEqual([]);
    });

    // The split-flap flip-card technique (this app's own SplitFlapTitle):
    // two faces stacked at the same position, only one ever actually
    // painted thanks to a 3D rotation plus backface-visibility:hidden.
    test("ignores a backface-hidden face rotated away from the viewer", async ({ page }) => {
        await page.setContent(`
            <div style="perspective:600px; font: 16px/1.2 sans-serif;">
                <div style="position:relative; transform-style:preserve-3d; transform:rotateX(180deg);">
                    <div style="position:absolute; inset:0; backface-visibility:hidden;">Front face text</div>
                    <div style="position:absolute; inset:0; backface-visibility:hidden; transform:rotateX(180deg);">Back face text</div>
                </div>
            </div>
        `);
        const overlaps = await findOverlappingText(page);
        expect(overlaps).toEqual([]);
    });
});

import type { Page } from "@playwright/test";

export type TextOverlap = {
    textA: string;
    textB: string;
    elementA: string;
    elementB: string;
};

// Walks every rendered text run in the document (document.body, so this
// also covers MUI's Dialog/Menu portals which mount outside the app root)
// and flags any two runs, from different elements, whose boxes overlap by
// more than a couple of px in both dimensions. Uses Range.getClientRects()
// per text node rather than element bounding boxes, so a padded/oversized
// container doesn't read as "overlapping" its neighbor - only the glyphs
// themselves count.
export async function findOverlappingText(page: Page): Promise<TextOverlap[]> {
    return page.evaluate(() => {
        type Rect = { left: number; top: number; right: number; bottom: number };
        type Entry = { text: string; rect: Rect; element: string; nodeId: number };

        const entries: Entry[] = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node: Node | null;
        let nodeId = 0;
        while ((node = walker.nextNode())) {
            const thisNodeId = nodeId++;
            const text = node.textContent?.trim();
            if (!text) continue;

            const parent = node.parentElement;
            if (!parent) continue;
            // aria-hidden is a screen-reader semantic, not a paint signal -
            // this app's own SplitFlapTitle marks its genuinely-visible face
            // <span>s aria-hidden="true" and puts the "real" accessible text
            // on an ancestor's aria-label instead, so treating aria-hidden
            // as "not visually there" in general would blind the detector to
            // exactly the kind of overlap it exists to catch.
            //
            // The one deliberate exception: MUI's Modal/Dialog marks this
            // app's own #root mount point aria-hidden="true" while it's
            // open, to inert the *entire* background page behind an opaque
            // dialog - that background content is still in the DOM with
            // real (dimmed, occluded) geometry, but a user can't see it
            // through the dialog's solid paper, so it isn't a real overlap
            // with the dialog's own text.
            if (parent.closest("script, style") || parent.closest('#root[aria-hidden="true"]')) continue;
            const style = getComputedStyle(parent);
            if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) continue;

            // CSS flip-card technique (this app's own SplitFlapTitle: two
            // faces stacked at the same position via rotateX +
            // backface-visibility:hidden, only one ever actually painted) -
            // compose every transform from this element up to the root to
            // get the true 3D orientation, since the rotation usually lives
            // on an ancestor (the shared flip pivot), not the face itself.
            const isBackfaceHiddenAndFacingAway = (start: Element): boolean => {
                let matrix = new DOMMatrix();
                let sawBackfaceHidden = false;
                let current: Element | null = start;
                while (current) {
                    const cs = getComputedStyle(current);
                    if (cs.transform && cs.transform !== "none") {
                        try {
                            matrix = new DOMMatrix(cs.transform).multiply(matrix);
                        } catch {
                            // Unparseable computed transform - shouldn't happen; ignore.
                        }
                    }
                    if (cs.backfaceVisibility === "hidden") sawBackfaceHidden = true;
                    current = current.parentElement;
                }
                // m33 is the z-component of the transformed (0,0,1) normal -
                // negative means this face ends up pointing away from the viewer.
                return sawBackfaceHidden && matrix.m33 < 0;
            };
            if (isBackfaceHiddenAndFacingAway(parent)) continue;

            // A text node's own layout box ignores clipping - e.g. a
            // white-space:nowrap + overflow:hidden + text-overflow:ellipsis
            // chip (this app's HeadsignChip) still has a full-width,
            // unclipped box for the untruncated string, which would
            // otherwise register as "overlapping" whatever sits past the
            // chip's visible edge even though nothing is actually painted
            // there. Clip through every overflow:hidden/auto/scroll
            // ancestor - including the immediate parent - before comparing.
            const clipToAncestors = (rect: Rect, start: Element): Rect | null => {
                let r = rect;
                let el: Element | null = start;
                while (el) {
                    const s = getComputedStyle(el);
                    if (s.overflowX !== "visible" || s.overflowY !== "visible") {
                        const cr = el.getBoundingClientRect();
                        r = {
                            left: Math.max(r.left, cr.left),
                            top: Math.max(r.top, cr.top),
                            right: Math.min(r.right, cr.right),
                            bottom: Math.min(r.bottom, cr.bottom),
                        };
                        if (r.right <= r.left || r.bottom <= r.top) return null;
                    }
                    el = el.parentElement;
                }
                return r;
            };

            const range = document.createRange();
            range.selectNodeContents(node);
            for (const raw of Array.from(range.getClientRects())) {
                if (raw.width < 1 || raw.height < 1) continue;
                const r = clipToAncestors(
                    { left: raw.left, top: raw.top, right: raw.right, bottom: raw.bottom },
                    parent
                );
                if (!r) continue;
                // Scrolled out of view or intentionally off-screen - not
                // something a user can actually see overlapping.
                if (r.bottom <= 0 || r.right <= 0 || r.top >= window.innerHeight || r.left >= window.innerWidth) {
                    continue;
                }
                entries.push({
                    text,
                    element:
                        parent.tagName.toLowerCase() +
                        (parent.id ? "#" + parent.id : "") +
                        (parent.getAttribute("class") ? "." + parent.getAttribute("class")!.trim().split(/\s+/).join(".") : ""),
                    rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
                    nodeId: thisNodeId,
                });
            }
        }

        const MIN_OVERLAP_PX = 2;
        const overlaps: { textA: string; textB: string; elementA: string; elementB: string }[] = [];
        for (let i = 0; i < entries.length; i++) {
            for (let j = i + 1; j < entries.length; j++) {
                const a = entries[i];
                const b = entries[j];
                // Same text node: e.g. Chrome gives a text-overflow:ellipsis
                // node two client rects (one spanning the full untruncated
                // logical width, one closer to the painted width) that can
                // overlap each other post-clip - that's a rendering
                // implementation detail of one run of text, not two runs
                // colliding.
                if (a.nodeId === b.nodeId) continue;
                const ix = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
                const iy = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
                if (ix > MIN_OVERLAP_PX && iy > MIN_OVERLAP_PX) {
                    overlaps.push({ textA: a.text, textB: b.text, elementA: a.element, elementB: b.element });
                }
            }
        }
        return overlaps;
    });
}

// Some layout depends on webfont metrics settling (e.g. SplitFlapTitle
// measures its own width via canvas once `document.fonts.ready` resolves,
// then re-renders) - scanning for overlaps before that finishes can race
// past a real bug. Call this right before findOverlappingText.
export async function waitForLayoutToSettle(page: Page): Promise<void> {
    await page.evaluate(() => document.fonts.ready);
    // The post-fonts-ready re-render (a state update + layout) still needs a
    // tick to commit - not observable through a Playwright wait condition,
    // so a short fixed pause is the pragmatic option here.
    await page.waitForTimeout(250);
}

// Pretty-prints findOverlappingText's result for a failed expect() message.
export function describeOverlaps(overlaps: TextOverlap[]): string {
    return overlaps
        .map((o) => `"${o.textA}" (${o.elementA})  overlaps  "${o.textB}" (${o.elementB})`)
        .join("\n");
}

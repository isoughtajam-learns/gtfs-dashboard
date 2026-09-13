import { test, expect } from "@playwright/test";
import { findOverlappingText, describeOverlaps, waitForLayoutToSettle } from "./utils/overlap";

const SYSTEMS = ["BART", "SF_MTA"];

// A couple of deliberately long fields (headsign, stop name) to stress
// column wrapping at the "small" (375px) project's width - that's exactly
// where truncation/wrap bugs tend to produce overlapping text.
const TRIP_UPDATES = [
    {
        trip_id: "trip-1",
        trip_headsign: "Richmond via a very long headsign that should wrap or truncate",
        stop_id: "stop-1",
        stop_name: "Some Very Long Station Name That Keeps Going And Going",
        previous: 1_700_000_000,
        next: 1_700_000_300,
        status: "In Transit",
        vehicle: "vehicle-1",
        color: "ff5a4e",
        text_color: "ffffff",
    },
    {
        trip_id: "trip-2",
        trip_headsign: "Millbrae",
        stop_id: "stop-2",
        stop_name: "Downtown Berkeley",
        previous: 1_700_000_100,
        next: 1_700_000_400,
        status: "Stopped",
        vehicle: "vehicle-2",
        color: null,
        text_color: null,
    },
];

const SAMPLE_ALERT = (id: string, extra: Partial<Record<string, unknown>> = {}) => ({
    alert_id: id,
    cause: "MAINTENANCE",
    effect: "SIGNIFICANT_DELAYS",
    severity_level: "WARNING",
    header_text: "N Judah: extended delays due to a very long and wordy maintenance description",
    description_text:
        "Extended delays due to a very long and wordy maintenance description that keeps going for a while to stress-test wrapping",
    url: "https://example.com/alert",
    active_period: [],
    affected_trips: [{ trip_id: "trip-1", trip_headsign: "Richmond", route_id: "route-1" }],
    affected_routes: [{ route_id: "route-1", route_short_name: "N", route_long_name: "N Judah" }],
    ...extra,
});

function toSseBody(events: unknown[]): string {
    return events.map((e) => `event: trip_update\ndata: ${JSON.stringify(e)}\n\n`).join("");
}

async function mockBackend(page: import("@playwright/test").Page) {
    await page.route("**/api/transit_systems", (route) => route.fulfill({ json: SYSTEMS }));
    await page.route("**/api/trip_updates/**", (route) =>
        route.fulfill({ contentType: "text/event-stream", body: toSseBody(TRIP_UPDATES) })
    );
    await page.route("**/api/service_alerts/**", (route) => route.fulfill({ json: [] }));
}

test.describe("no overlapping text", () => {
    test("Live page: system dropdown + event table", async ({ page }) => {
        await mockBackend(page);
        await page.goto("/");
        // Desktop and mobile layouts both render into the DOM at once (CSS
        // hides whichever doesn't apply at the current width), so this
        // matches two elements - one of them hidden depending on viewport.
        // toBeAttached() just confirms the mocked data made it into the DOM
        // before scanning the whole page for overlaps; which layout is
        // visible isn't this assertion's concern.
        await expect(page.getByText("Some Very Long Station Name That Keeps Going And Going").first()).toBeAttached();

        await waitForLayoutToSettle(page);
        const overlaps = await findOverlappingText(page);
        expect(overlaps, describeOverlaps(overlaps)).toEqual([]);
    });

    test("About page", async ({ page }) => {
        await mockBackend(page);
        await page.goto("/about");
        await page.waitForLoadState("networkidle");

        await waitForLayoutToSettle(page);
        const overlaps = await findOverlappingText(page);
        expect(overlaps, describeOverlaps(overlaps)).toEqual([]);
    });

    test("Service alerts modal with alerts loaded", async ({ page }) => {
        await page.route("**/api/transit_systems", (route) => route.fulfill({ json: SYSTEMS }));
        await page.route("**/api/trip_updates/**", (route) =>
            route.fulfill({ contentType: "text/event-stream", body: toSseBody([]) })
        );
        await page.route("**/api/service_alerts/**", (route) =>
            route.fulfill({ json: [SAMPLE_ALERT("alert-1"), SAMPLE_ALERT("alert-2", { severity_level: null })] })
        );

        await page.goto("/");
        await page.getByLabel("Service alerts").click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await expect(page.getByText("Alert ID: alert-1")).toBeVisible();

        await waitForLayoutToSettle(page);
        const overlaps = await findOverlappingText(page);
        expect(overlaps, describeOverlaps(overlaps)).toEqual([]);
    });
});

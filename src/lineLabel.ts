// SF-MTA's route_long_name arrives ALL CAPS from schedule data (e.g.
// "VAN NESS-MISSION", "MARKET & WHARVES") - title-cases each
// whitespace/hyphen-separated word so it reads like real signage
// ("Van Ness-Mission") rather than shouting.
const titleCase = (value: string): string =>
    value
        .toLowerCase()
        .split(" ")
        .map((word) => word.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("-"))
        .join(" ");

// SF-MTA colloquially - and on a lot of real signage - refers to lines by
// combining route_short_name + route_long_name (e.g. "N Judah", "38R Geary
// Rapid"). Unique to SF-MTA among the systems this app serves (confirmed
// live: BART's own route_short_name/route_long_name are internal
// color-line codes and verbose from-to descriptions, not rider-facing).
// Explicitly scoped to SF-MTA rather than "any system with both fields
// set", so another system populating those fields differently doesn't
// silently start combining too.
//
// Returns null whenever either field is missing (true for roughly half of
// SF-MTA's own trips - not every trip's route resolves in schedule data) or
// for every other system - callers supply their own fallback for that
// case, since what's appropriate differs by where this is displayed: the
// event feed's Line column falls back to trip_headsign (see
// EventStreamComponent's lineLabel), while TripDetailCard's route badge
// falls back to the raw route_long_name it already shows today.
export function sfMtaRouteLabel(
    systemId: string,
    routeShortName: string | null | undefined,
    routeLongName: string | null | undefined
): string | null {
    if (systemId === "SF-MTA" && routeShortName && routeLongName) {
        return `${routeShortName} ${titleCase(routeLongName)}`;
    }
    return null;
}

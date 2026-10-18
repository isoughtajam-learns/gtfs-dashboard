// Some systems' route_long_name arrives ALL CAPS from schedule data (e.g.
// SF-MTA's "VAN NESS-MISSION", "MARKET & WHARVES") - title-cases each
// whitespace/hyphen-separated word so it reads like real signage
// ("Van Ness-Mission") rather than shouting. Only applied when the whole
// string is shouting (see isShouting below) - most systems' long_names
// already use normal/mixed case (including real abbreviations like "BART"
// or "MLK" embedded in an otherwise-normal string), and running this
// unconditionally would mangle those into "Bart"/"Mlk".
const titleCase = (value: string): string =>
    value
        .toLowerCase()
        .split(" ")
        .map((word) => word.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("-"))
        .join(" ");

// Requires a space, not just "all uppercase" - a bare whole-string
// abbreviation like "BART"/"SFO"/"VTA" is all-caps but isn't shouting
// prose, and title-casing it would produce exactly the "Bart"/"Sfo"/"Vta"
// mangling this function exists to avoid. Every real shouting long_name
// seen (SF-MTA's "VAN NESS-MISSION", "MARKET & WHARVES") is multi-word.
const isShouting = (value: string): boolean =>
    value.includes(" ") && value === value.toUpperCase() && value !== value.toLowerCase();

// Confirmed live across every active Bay Area system (IRL-13/IRL-22): the
// clean, system-agnostic split is whether route_short_name literally equals
// route_id, not which system or GTFS route_type (bus/rail/ferry/etc.) a
// route belongs to.
//
// route_short_name == route_id (every route, in 8 of 9 systems, including
// SF-MTA's bus/rail/cable-car routes alike and VTA's color-named light
// rail lines) means short_name genuinely identifies the route the way
// real signage does - concatenating short_name + long_name reads like
// "N Judah", "38R Geary Rapid", "72 CCC - San Pablo", "Blue Line Baypointe
// - Santa Teresa".
//
// route_short_name != route_id (BART, uniquely among what's been seen) means
// short_name is an internal color+direction grouping code riders never see
// (e.g. "Yellow-S" vs route_id "1") - long_name alone already reads like
// real BART signage ("Berryessa/North San Jose to Daly City"), and
// concatenating would just inject an internal code into the display.
// Returns null in that case; callers supply their own fallback (trip_headsign
// for the event feed's Line column, the raw route_long_name for
// TripDetailCard's badge - see each call site).
export function routeLineLabel(
    routeId: string | null | undefined,
    routeShortName: string | null | undefined,
    routeLongName: string | null | undefined
): string | null {
    if (!routeShortName || routeShortName !== routeId) {
        return null;
    }
    const longName = routeLongName && isShouting(routeLongName) ? titleCase(routeLongName) : routeLongName;
    return longName ? `${routeShortName} ${longName}` : routeShortName;
}

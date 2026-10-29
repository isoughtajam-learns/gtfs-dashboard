import type { IntraSystemTransfer } from "./TransferIndicators.tsx";

// Split out of TransferIndicators.tsx (a components-only file, so Fast
// Refresh keeps working there) - the one place "does this stop/trip have
// anything to show" is defined. Both TransferIndicators' own null-return
// and callers that need to know in advance (to decide whether to render a
// wrapping row at all; see EventStreamComponent.tsx/TripDetailCard.tsx's
// mobile layouts) call this instead of re-deriving the same boolean inline.
export const hasTransfers = (
    intraSystemTransfers: IntraSystemTransfer[] | undefined,
    interSystemTransferSystems: string[] | undefined
): boolean =>
    (intraSystemTransfers?.length ?? 0) > 0 || (interSystemTransferSystems?.length ?? 0) > 0;

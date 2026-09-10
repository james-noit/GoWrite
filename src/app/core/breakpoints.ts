// The desktop-style single-row toolbar strip only makes sense with a mouse (fine pointer) or on
// a genuinely wide screen — a touch tablet at 768-1023px still needs the phone's disclosure
// sheet, since a coarse pointer's larger touch targets would otherwise push a third of the
// controls off the edge of a single non-wrapping row. Shared so every touch-only surface (the
// toolbar sheet, the mobile support button, ...) agrees on exactly the same cutoff.
export const FULL_TOOLBAR_TIER_QUERY = '(min-width: 1024px), (min-width: 768px) and (pointer: fine)';

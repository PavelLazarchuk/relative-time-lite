---
'relative-time-lite': minor
---

Hydration without a mismatch: `hydrationText`, `serverNow` and `<RelativeTimeProvider>`.

- Both hooks take `hydrationText`, rendered by the server pass and the hydration pass; the live text arrives on the frame after. It is the cheapest answer to the clock moving between the two renders, and it puts nothing in the HTML to disagree about.
- Both hooks take `serverNow`, the moment those two passes measure from, for markup that has to carry real words for a crawler. Neither option freezes the clock — `now` is still the one that does that.
- New `<RelativeTimeProvider now={requestTime} hydrationText="…">` in `relative-time-lite/react` supplies either default to a subtree. A hook that names either option ignores the provider rather than merging with it, and `hydrationText` wins when a call names both.

This retires the "server rendering" limitation the README documented.

The React entry grows to 2.79 kB gzipped; the root entry is unchanged.

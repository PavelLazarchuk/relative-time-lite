---
'relative-time-lite': minor
---

One timer for the page, stores that can be moved, and wording of your own.

- Every live store now shares a single `setTimeout`, always aimed at the earliest deadline any of them is waiting for. A feed of two hundred live timestamps arms one timer instead of two hundred; the pacing each store gets is unchanged.
- `store.setDate(date)` and `store.setOptions(options)` point a store that is already subscribed at another timestamp or another option set. Both keep every subscription, re-pace the timer, and notify only if the text actually changed. `useRelativeTime` and `useRelativeTimeParts` use them: a changed date or option no longer tears down the store and re-subscribes.
- New `format` option, everywhere a distance is formatted: `({ value, unit, date, now }) => string | undefined`. It is consulted first, and returning `undefined` hands the decision back to `justNowText` and then to `Intl.RelativeTimeFormat` — so it covers "yesterday at 14:00", a "just now" without a `justNowSeconds` window, or replacing the platform formatter outright.
- A runtime without `Intl.RelativeTimeFormat` now throws a `TypeError` naming the package instead of failing inside the constructor.

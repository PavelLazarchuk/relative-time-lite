---
'relative-time-lite': minor
---

Unit control, parts output, and a live updater that wakes when it has to

**Unit options everywhere.** `relativeTime`, `relativeTimeParts`, `selectUnit`, the store and both hooks now take `minUnit`, `maxUnit`, `rounding` and `justNowSeconds`, so the ladder can be clamped at either end, truncated instead of rounded, or fronted with a flat "now" window.

**`relativeTimeParts` and `useRelativeTimeParts`.** The formatted text together with the `value` and `unit` behind it, so markup that needs the decision — a `<time>` that falls back to an absolute date past a certain unit — no longer has to derive it twice. The store exposes the same thing as `getParts()`, and both keep one object identity until the words change.

**Live timestamps now sleep to the edge, not to a grid.** Each tick is scheduled for the moment the displayed number is actually due to change: a "2 hours ago" wakes when it becomes three, where it used to check every half hour and could show the wrong hour for up to thirty minutes. Weeks, months and years have no fixed length, so those close in on the crossing instead, trading a handful of silent checks for never being late.

**Store options.** `refreshMs` replaces the self-paced schedule with a fixed interval, and `trackVisibility: false` opts out of suspending on a hidden tab.

**`useRelativeTime` accepts `null` and `undefined`,** rendering an empty string, so a timestamp that may not have arrived yet no longer forces a conditional hook. `useRelativeTimeParts` returns `null` for the same input, and TypeScript narrows that away when the date is certainly there.

**Fixes.** A store with a pinned `now` no longer registers a `visibilitychange` watcher it can never use. The formatter cache evicts least-recently-used rather than oldest-first, so a hot locale survives a busy cache. `selectUnit` rejects non-finite timestamps with a `TypeError` instead of returning `NaN`, and its calendar-month correction is a single step rather than a loop.

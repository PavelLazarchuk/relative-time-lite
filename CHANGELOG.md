# relative-time-lite

## 1.2.0

### Minor Changes

- cbe7dae: `justNowText` gives the `justNowSeconds` window its own wording ("just now") instead of leaving it to the locale's "now".

    Fixes: a `refreshMs` of `0`, a negative or a `NaN` one no longer re-arms the timer on every drain of the queue; a `justNowSeconds` that is not a positive number is ignored instead of skewing the pacing; a calendar unit whose average-length estimate reads as overdue sleeps a fraction of that unit rather than dropping to the 250 ms floor; live stores catch up on `focus` and `pageshow` as well as `visibilitychange`, so a timer a sleeping machine never fired cannot leave a stale timestamp on screen; and an unparsable date passed to the React hooks renders an empty string instead of throwing through the render.

## 1.1.0

### Minor Changes

- 68e67b0: Unit control, parts output, and a live updater that wakes when it has to

    **Unit options everywhere.** `relativeTime`, `relativeTimeParts`, `selectUnit`, the store and both hooks now take `minUnit`, `maxUnit`, `rounding` and `justNowSeconds`, so the ladder can be clamped at either end, truncated instead of rounded, or fronted with a flat "now" window.

    **`relativeTimeParts` and `useRelativeTimeParts`.** The formatted text together with the `value` and `unit` behind it, so markup that needs the decision — a `<time>` that falls back to an absolute date past a certain unit — no longer has to derive it twice. The store exposes the same thing as `getParts()`, and both keep one object identity until the words change.

    **Live timestamps now sleep to the edge, not to a grid.** Each tick is scheduled for the moment the displayed number is actually due to change: a "2 hours ago" wakes when it becomes three, where it used to check every half hour and could show the wrong hour for up to thirty minutes. Weeks, months and years have no fixed length, so those close in on the crossing instead, trading a handful of silent checks for never being late.

    **Store options.** `refreshMs` replaces the self-paced schedule with a fixed interval, and `trackVisibility: false` opts out of suspending on a hidden tab.

    **`useRelativeTime` accepts `null` and `undefined`,** rendering an empty string, so a timestamp that may not have arrived yet no longer forces a conditional hook. `useRelativeTimeParts` returns `null` for the same input, and TypeScript narrows that away when the date is certainly there.

    **Fixes.** A store with a pinned `now` no longer registers a `visibilitychange` watcher it can never use. The formatter cache evicts least-recently-used rather than oldest-first, so a hot locale survives a busy cache. `selectUnit` rejects non-finite timestamps with a `TypeError` instead of returning `NaN`, and its calendar-month correction is a single step rather than a loop.

## 1.0.1

### Patch Changes

- 83725c2: Reject an invalid `locale` consistently, whatever was formatted before it

    Two paths could quietly accept a locale the runtime should have rejected, so the
    same argument threw a `RangeError` or did not depending on call order and on
    which entry point it went through.

    - `useRelativeTime` reduced `locale` to a primitive by joining a fallback list
      with a comma, then split it back apart. A single tag containing a comma
      survived the round trip as a list, so `useRelativeTime(d, { locale: 'de,en' })`
      rendered German while `relativeTime(d, { locale: 'de,en' })` threw. The hook
      now keeps a lone tag and a list apart and matches the core exactly.
    - The formatter cache keyed `undefined`, `''`, `[]` and `['']` identically, so an
      empty tag returned the cached default formatter instead of throwing once
      anything had been formatted without a locale. Each distinct input now gets its
      own key; `undefined` and `[]` still share one, since both mean the runtime
      default.

    The `{ relativeTime }` bundle grows from 778 B to 795 B gzipped.

## 1.0.0

### Major Changes

- Initial release.
- `relativeTime()` on top of the platform's `Intl.RelativeTimeFormat`, with no bundled locale data.
- Calendar-correct unit selection: unequal month lengths, leap years and DST.
- Self-pacing auto-update store that suspends in background tabs.
- `relative-time-lite/react` — `useRelativeTime` via `useSyncExternalStore`.
- TypeScript support.
- Documentation.

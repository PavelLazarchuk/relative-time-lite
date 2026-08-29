# relative-time-lite

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

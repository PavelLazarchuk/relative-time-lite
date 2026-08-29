# relative-time-lite

## 1.0.0

### Major Changes

- Initial release.
- `relativeTime()` on top of the platform's `Intl.RelativeTimeFormat`, with no bundled locale data.
- Calendar-correct unit selection: unequal month lengths, leap years and DST.
- Self-pacing auto-update store that suspends in background tabs.
- `relative-time-lite/react` — `useRelativeTime` via `useSyncExternalStore`.
- TypeScript support.
- Documentation.

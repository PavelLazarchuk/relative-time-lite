---
'relative-time-lite': patch
---

Fix a live store serving a frozen text to callers that read `getSnapshot()`/`getParts()` without subscribing: with no listeners there are no ticks to refresh it, so the reads now consult the clock themselves and keep the cached object only while the words are unchanged.

Fix the just-now window waking early for a future timestamp: the window ends `justNowSeconds + diff` from now, not `justNowSeconds - |diff|`, so a target still ahead of now no longer costs a run of no-op ticks on the way out.

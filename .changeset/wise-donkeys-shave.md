---
'relative-time-lite': minor
---

A `timeZone` option and a `quarter` unit.

- New `timeZone` option, accepted everywhere a distance is measured — `relativeTime`, `relativeTimeParts`, `selectUnit`, the store and both hooks. It names the IANA calendar that months, quarters and years are measured against, following that zone's offset and DST rules at each instant. Left out, the behaviour is unchanged: the runtime's own zone, which is the reader's in a browser. Passing the same zone on the server and the client removes the calendar half of the hydration mismatch the README used to document as a limitation.
- `quarter` joins `RelativeTimeUnit`, between `month` and `year`. The unclamped ladder never picks it — it still steps from months straight to years — so it is reachable only by naming it in `minUnit` or `maxUnit`, and `maxUnit: 'quarter'` now says "4 quarters ago" where the ladder would have said "last year".

`timeZone` costs about 200 B gzipped on every entry point, so the quoted sizes move: `selectUnit` alone to 909 B, `relativeTime` to 1.39 kB, the root entry to 2.38 kB, and the React entry to 2.67 kB. It reads the offset through `timeZoneName: 'longOffset'`, which wants Node 18+, Chrome 95+, Safari 15.4+ or Firefox 91+; nothing else in the package touches it.

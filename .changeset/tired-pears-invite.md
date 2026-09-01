---
'relative-time-lite': minor
---

`justNowText` gives the `justNowSeconds` window its own wording ("just now") instead of leaving it to the locale's "now".

Fixes: a `refreshMs` of `0`, a negative or a `NaN` one no longer re-arms the timer on every drain of the queue; a `justNowSeconds` that is not a positive number is ignored instead of skewing the pacing; a calendar unit whose average-length estimate reads as overdue sleeps a fraction of that unit rather than dropping to the 250 ms floor; live stores catch up on `focus` and `pageshow` as well as `visibilitychange`, so a timer a sleeping machine never fired cannot leave a stale timestamp on screen; and an unparsable date passed to the React hooks renders an empty string instead of throwing through the render.

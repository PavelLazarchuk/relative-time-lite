# relative-time-lite

[![npm version](https://img.shields.io/npm/v/relative-time-lite.svg)](https://www.npmjs.com/package/relative-time-lite)
[![npm downloads](https://img.shields.io/npm/dm/relative-time-lite.svg)](https://www.npmjs.com/package/relative-time-lite)

Relative time formatting — "3 minutes ago", "in 2 months" — in **795 B gzipped**, with a live-updating React hook in the box.

```sh
npm install relative-time-lite
```

Every word comes from the platform's own `Intl.RelativeTimeFormat`. This package ships **zero locale data**: it decides _which_ unit to say and _when_ to say it again, and hands the wording to the runtime. Every locale your JavaScript engine knows already works, and adding the fiftieth one costs nothing.

## Quick start

```ts
import { relativeTime } from 'relative-time-lite';

const published = Date.now() - 90_000;

relativeTime(published); // → '2 minutes ago'
relativeTime(Date.now() - 86_400_000); // → 'yesterday'
relativeTime(Date.now() + 3 * 86_400_000); // → 'in 3 days'

relativeTime(published, { locale: 'ru' }); // → '2 минуты назад'
relativeTime(published, { locale: 'de', style: 'short' }); // → 'vor 2 Min.'
```

React, updating itself as the clock moves:

```tsx
import { useRelativeTime } from 'relative-time-lite/react';

function PostedAt({ at }: { at: string }) {
    return <time dateTime={at}>{useRelativeTime(at)}</time>;
}
```

## Why

|                             |                                                                                                                                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No locale data**          | `Intl.RelativeTimeFormat` has been in every browser since 2020 and in Node since 12. Bundling 400 kB of translations to repeat what the platform already knows is the mistake this package avoids.    |
| **Calendar-correct**        | Months are 28–31 days and years are 365 or 366. Month and year distances come from the calendar, not from a 30.44-day average, so "1 month ago" means the same day last month.                        |
| **Paced, not polled**       | A live timestamp reschedules itself from the unit it is currently showing: every second while it says seconds, every half hour once it says hours. No `setInterval` running for the life of the page. |
| **Quiet in the background** | Updates stop while the tab is hidden and catch up the moment it comes back.                                                                                                                           |
| **React-free core**         | React is only reachable through `relative-time-lite/react`, enforced by a build check. The root entry imports nothing.                                                                                |

## API

### `relativeTime(date, options?): string`

```ts
import { relativeTime } from 'relative-time-lite';

relativeTime(new Date('2024-01-01'));
relativeTime(1704067200000);
relativeTime('2024-01-01T00:00:00Z');
```

`date` may be a `Date`, epoch milliseconds, or any string `Date.parse` accepts. Anything that would end up as `NaN` — an unparsable string, an invalid `Date`, `undefined` — throws a `TypeError` naming the package, rather than quietly formatting the words "NaN years ago".

#### Options

| Option    | Type                            | Default         | Description                                      |
| --------- | ------------------------------- | --------------- | ------------------------------------------------ |
| `locale`  | `string \| readonly string[]`   | runtime default | BCP 47 tag, or a fallback list.                  |
| `style`   | `'long' \| 'short' \| 'narrow'` | `'long'`        | Passed through to `Intl.RelativeTimeFormat`.     |
| `numeric` | `'always' \| 'auto'`            | `'auto'`        | `'auto'` prefers "yesterday" over "1 day ago".   |
| `now`     | `Date \| number \| string`      | `Date.now()`    | Measure from a fixed point instead of the clock. |

`numeric` defaults to `'auto'` rather than `Intl`'s own `'always'`, because "yesterday" is what almost every UI wants. Pass `'always'` to get the plain number back.

`now` turns the function into a plain distance between two instants, which is what tests and server rendering usually want:

```ts
relativeTime('2024-03-15T09:00:00Z', { now: '2024-03-15T12:00:00Z' }); // → '3 hours ago'
```

### `useRelativeTime(date, options?): string`

```tsx
import { useRelativeTime } from 'relative-time-lite/react';

function Comment({ postedAt }: { postedAt: number }) {
    const ago = useRelativeTime(postedAt, { locale: 'en' });

    return <span>{ago}</span>;
}
```

Same arguments as `relativeTime`. The string keeps itself current and the component re-renders **only when the words actually change** — a comment from last Tuesday re-renders zero times over the next six hours, even though the hook wakes up to check.

Built on `useSyncExternalStore`, so the clock stays the source of truth, concurrent rendering sees a consistent value within a pass, and there is no `useState`/`useEffect` handshake to tear. The timer is torn down on unmount.

Inline arguments are safe: `useRelativeTime(new Date(x), { locale: ['en'] })` does not rebuild the underlying timer on every render — the date and options are reduced to primitives first.

`react` is an optional peer dependency (`>=18`). The entry point is marked `'use client'` for the Next.js App Router; the value it renders depends on the clock, so it cannot be a server component.

### `createRelativeTimeStore(date, options?): RelativeTimeStore`

The engine under the hook, for any other framework — or none:

```ts
import { createRelativeTimeStore } from 'relative-time-lite';

const store = createRelativeTimeStore(comment.createdAt, { locale: 'en' });
const node = document.querySelector('time')!;

node.textContent = store.getSnapshot();

const unsubscribe = store.subscribe(() => {
    node.textContent = store.getSnapshot();
});

// later
unsubscribe();
```

`getSnapshot()` is stable between ticks — repeated reads return the identical string until the text genuinely changes. `subscribe()` returns the unsubscribe; the last one clears the timer and detaches the shared `visibilitychange` listener.

### `selectUnit(fromMs, toMs): { value, unit }`

The pure unit picker, exported for anyone who wants the decision without the formatting — a custom formatter, `<time>` tooltips, tests.

```ts
import { selectUnit } from 'relative-time-lite';

selectUnit(now, now - 90_000); // → { value: -2, unit: 'minute' }
selectUnit(now, now + 86_400_000); // → { value: 1, unit: 'day' }
```

No clock access, no side effects. `value` is negative in the past and positive in the future, ready to hand straight to `Intl.RelativeTimeFormat.format`.

## How units are chosen

Each threshold is checked on the **rounded** value, so the switch happens at the halfway point rather than a unit late: 59.5 seconds is already "1 minute ago", not "59 seconds ago". Rounding ties break away from zero, so the past and the future flip at exactly the same distance.

| Range                          | Unit     |
| ------------------------------ | -------- |
| under 60 rounded seconds       | `second` |
| under 60 rounded minutes       | `minute` |
| under 24 rounded hours         | `hour`   |
| under 7 rounded days           | `day`    |
| up to one whole calendar month | `week`   |
| under 12 calendar months       | `month`  |
| beyond that                    | `year`   |

Weeks fill the stretch between a week and a month, which caps them at 4 — you will never see "5 weeks ago" turn up next to "last month".

### Calendars and clocks

Seconds through days are measured in elapsed time. A day is 24 real hours, so noon-to-noon across a spring-forward reads "23 hours ago" — which is what actually elapsed.

Months and years are measured on the calendar, in the local time zone:

- Feb 1 → Mar 1 is one month, whether February had 28 days or 29.
- Jan 31 + one month is Feb 28 (or 29), the standard clamp, so that pair reads "last month".
- A year is a year across two DST transitions and any number of leap days.

## Bundle size

Measured gzipped, with `size-limit`:

| Import                                      | Size    |
| ------------------------------------------- | ------- |
| `import { selectUnit }`                     | 414 B   |
| `import { relativeTime }`                   | 795 B   |
| the whole root entry                        | 1.17 kB |
| `relative-time-lite/react` (React excluded) | 1.26 kB |

The package is side-effect free and every export is tree-shakeable, so importing only `relativeTime` leaves the auto-update engine out of your bundle entirely.

## Notes

**Server rendering.** `relativeTime` and the hook's server snapshot are the same computation, but the clock moves between the render and the hydration — a timestamp that says "3 hours ago" on the server may want to say "4 hours ago" by the time the browser gets there, and React will report a hydration mismatch. Pass a fixed `now` for the server pass, or render the absolute time and let the hook take over on the client.

**Time zones.** Month and year distances depend on the local zone, since that is the calendar the reader is looking at. Fix `TZ` if you need byte-identical output between a server and a browser.

**Why no `WeakRef`.** Letting the garbage collector decide when a visible timestamp stops updating trades a deterministic leak for a nondeterministic bug. The store instead ties its lifetime to explicit subscription: the timer exists only while a listener does, and a single shared `visibilitychange` listener serves every store on the page, attached with the first subscription and removed with the last.

## Requirements

Any runtime with `Intl.RelativeTimeFormat`: Node 12+, and every browser since early 2020. Node builds without full ICU (`--with-intl=small-icu`) only carry English — use `full-icu` if you need more.

## License

MIT © Pavel Lazarchuk

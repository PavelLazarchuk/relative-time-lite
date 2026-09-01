# relative-time-lite

[![npm version](https://img.shields.io/npm/v/relative-time-lite.svg)](https://www.npmjs.com/package/relative-time-lite)
[![npm downloads](https://img.shields.io/npm/dm/relative-time-lite.svg)](https://www.npmjs.com/package/relative-time-lite)

Relative time formatting — "3 minutes ago", "in 2 months" — in **1.04 kB gzipped**, with a live-updating React hook in the box.

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

|                             |                                                                                                                                                                                                                                  |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No locale data**          | `Intl.RelativeTimeFormat` has been in every browser since 2020 and in Node since 12. Bundling 400 kB of translations to repeat what the platform already knows is the mistake this package avoids.                               |
| **Calendar-correct**        | Months are 28–31 days and years are 365 or 366. Month and year distances come from the calendar, not from a 30.44-day average, so "1 month ago" means the same day last month.                                                   |
| **Paced, not polled**       | A live timestamp sleeps until the moment its own words are due to change — a "2 hours ago" wakes when it becomes three, not on a half-hourly grid. No `setInterval` running for the life of the page.                            |
| **Quiet in the background** | Updates stop while the tab is hidden and catch up the moment it comes back, on a window focus, or on a restore from the back/forward cache — so a timer a sleeping machine never fired cannot leave a stale timestamp on screen. |
| **React-free core**         | React is only reachable through `relative-time-lite/react`, enforced by a build check. The root entry imports nothing.                                                                                                           |

## API

### `relativeTime(date, options?): string`

```ts
import { relativeTime } from 'relative-time-lite';

relativeTime(new Date('2024-01-01'));
relativeTime(1704067200000);
relativeTime('2024-01-01T00:00:00Z');
```

`date` may be a `Date`, epoch milliseconds, or any string `Date.parse` accepts — ISO 8601 is the only string format every runtime agrees on, so anything else is at the engine's discretion. Anything that would end up as `NaN` — an unparsable string, an invalid `Date`, `undefined` — throws a `TypeError` naming the package, rather than quietly formatting the words "NaN years ago". The React hooks are the exception: an unparsable date renders an empty string there, the same as a missing one.

#### Options

| Option        | Type                            | Default         | Description                                      |
| ------------- | ------------------------------- | --------------- | ------------------------------------------------ |
| `locale`      | `string \| readonly string[]`   | runtime default | BCP 47 tag, or a fallback list.                  |
| `style`       | `'long' \| 'short' \| 'narrow'` | `'long'`        | Passed through to `Intl.RelativeTimeFormat`.     |
| `numeric`     | `'always' \| 'auto'`            | `'auto'`        | `'auto'` prefers "yesterday" over "1 day ago".   |
| `justNowText` | `string`                        | —               | Wording for the `justNowSeconds` window.         |
| `now`         | `Date \| number \| string`      | `Date.now()`    | Measure from a fixed point instead of the clock. |

Four more shape the unit itself, and are accepted everywhere a distance is measured — `relativeTime`, `relativeTimeParts`, `selectUnit`, the store and both hooks:

| Option           | Type                 | Default    | Description                                                |
| ---------------- | -------------------- | ---------- | ---------------------------------------------------------- |
| `minUnit`        | `RelativeTimeUnit`   | `'second'` | Finest unit to use. Anything smaller is said in this one.  |
| `maxUnit`        | `RelativeTimeUnit`   | `'year'`   | Coarsest unit to use. Anything larger is said in this one. |
| `rounding`       | `'round' \| 'floor'` | `'round'`  | `'floor'` truncates towards zero.                          |
| `justNowSeconds` | `number`             | `0`        | Distances shorter than this collapse to "now".             |

```ts
relativeTime(ts, { justNowSeconds: 45 }); // → 'now', for the first 45 seconds
relativeTime(ts, { justNowSeconds: 45, justNowText: 'just now' }); // → 'just now'
relativeTime(ts, { rounding: 'floor' }); // → '59 minutes ago', not '1 hour ago'
relativeTime(ts, { minUnit: 'minute' }); // → 'this minute', never seconds
relativeTime(ts, { maxUnit: 'day' }); // → '90 days ago', never months
```

`maxUnit` is also the way to hand off to an absolute date: cap the ladder, read the `unit` back from `relativeTimeParts`, and render a real date once it reaches the cap.

`numeric` defaults to `'auto'` rather than `Intl`'s own `'always'`, because "yesterday" is what almost every UI wants. Pass `'always'` to get the plain number back.

`now` turns the function into a plain distance between two instants, which is what tests and server rendering usually want:

```ts
relativeTime('2024-03-15T09:00:00Z', { now: '2024-03-15T12:00:00Z' }); // → '3 hours ago'
```

### `relativeTimeParts(date, options?): { value, unit, text }`

The same formatting with the decision that produced it, so markup that needs the unit does not have to derive it a second time:

```ts
import { relativeTimeParts } from 'relative-time-lite';

const { value, unit, text } = relativeTimeParts(comment.createdAt, { maxUnit: 'day' });
// → { value: -3, unit: 'minute', text: '3 minutes ago' }

unit === 'day' && value <= -30 ? absolute(comment.createdAt) : text;
```

`relativeTime` is this function's `.text`, and takes exactly the same options.

### `useRelativeTime(date, options?): string`

```tsx
import { useRelativeTime } from 'relative-time-lite/react';

function Comment({ postedAt }: { postedAt: number }) {
    const ago = useRelativeTime(postedAt, { locale: 'en' });

    return <span>{ago}</span>;
}
```

Same arguments as `relativeTime`, plus the store's own `refreshMs` and `trackVisibility`. The string keeps itself current and the component re-renders **only when the words actually change** — a comment from last Tuesday re-renders zero times over the next six hours, even though the hook wakes up to check.

Built on `useSyncExternalStore`, so the clock stays the source of truth, concurrent rendering sees a consistent value within a pass, and there is no `useState`/`useEffect` handshake to tear. The timer is torn down on unmount.

Inline arguments are safe: `useRelativeTime(new Date(x), { locale: ['en'] })` does not rebuild the underlying timer on every render — the date and options are reduced to primitives first.

A `null`, `undefined` or unparsable date renders an empty string rather than throwing, so a timestamp that may not have arrived yet — or one a row of API data got wrong — does not force a conditional hook and cannot take the tree down:

```tsx
useRelativeTime(order.shippedAt ?? null); // → '' until it ships
```

`react` is an optional peer dependency (`>=18`). The entry point is marked `'use client'` for the Next.js App Router; the value it renders depends on the clock, so it cannot be a server component.

### `useRelativeTimeParts(date, options?): { value, unit, text } | null`

`useRelativeTime` with the decision behind the words, kept just as current:

```tsx
function PostedAt({ at }: { at: string }) {
    const { text, unit } = useRelativeTimeParts(at, { maxUnit: 'day' });

    return unit === 'day' ? (
        <time dateTime={at}>{absolute(at)}</time>
    ) : (
        <time dateTime={at}>{text}</time>
    );
}
```

The object is replaced only when the text changes, so it is safe to compare by identity or pass into a `useMemo`. It is `null` — and only `null` — when the date is `null` or `undefined`; TypeScript narrows that away for a date that is certainly there.

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

`getSnapshot()` is stable between ticks — repeated reads return the identical string until the text genuinely changes. `getParts()` is the same value as `{ value, unit, text }`, and likewise keeps one object identity until the words move. `subscribe()` returns the unsubscribe; the last one clears the timer and detaches the shared `visibilitychange` listener.

Two options belong to the store alone:

| Option            | Type      | Default | Description                                                             |
| ----------------- | --------- | ------- | ----------------------------------------------------------------------- |
| `refreshMs`       | `number`  | —       | Tick on a fixed interval instead of self-pacing, no faster than 250 ms. |
| `trackVisibility` | `boolean` | `true`  | Suspend ticks while the document is hidden.                             |

A pinned `now` freezes the distance, so such a store schedules nothing and watches nothing — it is a formatted string with a `subscribe` that never fires.

### `selectUnit(fromMs, toMs, options?): { value, unit }`

The pure unit picker, exported for anyone who wants the decision without the formatting — a custom formatter, `<time>` tooltips, tests.

```ts
import { selectUnit } from 'relative-time-lite';

selectUnit(now, now - 90_000); // → { value: -2, unit: 'minute' }
selectUnit(now, now + 86_400_000); // → { value: 1, unit: 'day' }
```

No clock access, no side effects. `value` is negative in the past and positive in the future, ready to hand straight to `Intl.RelativeTimeFormat.format`. It takes the four ladder options above, and throws a `TypeError` on a timestamp that is not finite rather than returning a `NaN` nobody checks.

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

`minUnit` and `maxUnit` clamp this ladder from either end: the distance is then expressed in the nearest allowed unit, however large or small the number gets. `rounding: 'floor'` moves every threshold from the halfway point to the whole one, and `justNowSeconds` puts a flat "now" in front of the whole thing.

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
| `import { selectUnit }`                     | 695 B   |
| `import { relativeTime }`                   | 1.04 kB |
| the whole root entry                        | 1.62 kB |
| `relative-time-lite/react` (React excluded) | 1.80 kB |

The package is side-effect free and every export is tree-shakeable, so importing only `relativeTime` leaves the auto-update engine out of your bundle entirely.

## Notes

**Server rendering.** `relativeTime` and the hook's server snapshot are the same computation, but the clock moves between the render and the hydration — a timestamp that says "3 hours ago" on the server may want to say "4 hours ago" by the time the browser gets there, and React will report a hydration mismatch. Pass a fixed `now` for the server pass, or render the absolute time and let the hook take over on the client.

**Time zones.** There is no `timeZone` option: month and year distances are measured on the calendar of whatever zone the runtime is in, since that is the calendar the reader is looking at. A server running in UTC and a browser in `Europe/Warsaw` therefore disagree about where a month boundary falls, and a distance within a few hours of one can render differently on each side — a second, quieter source of hydration mismatch on top of the moving clock above. Fix `TZ` on the server, or pass a fixed `now`, if you need the two to agree byte for byte.

**Why no `WeakRef`.** Letting the garbage collector decide when a visible timestamp stops updating trades a deterministic leak for a nondeterministic bug. The store instead ties its lifetime to explicit subscription: the timer exists only while a listener does, and a single shared set of `visibilitychange`, `focus` and `pageshow` listeners serves every store on the page, attached with the first subscription and removed with the last.

## Requirements

Any runtime with `Intl.RelativeTimeFormat`: Node 12+, and every browser since early 2020. Node builds without full ICU (`--with-intl=small-icu`) only carry English — use `full-icu` if you need more.

## License

MIT © Pavel Lazarchuk

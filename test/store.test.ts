/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRelativeTimeStore } from '../src/store';
import type { RelativeTimeStoreOptions } from '../src/types';

const NOW = new Date('2024-03-15T12:00:00.000Z');

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const setHidden = (hidden: boolean) => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: hidden });
    Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        value: hidden ? 'hidden' : 'visible',
    });
    document.dispatchEvent(new Event('visibilitychange'));
};

describe('createRelativeTimeStore', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
        Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('formats before anything subscribes', () => {
        const store = createRelativeTimeStore(NOW.getTime() - 3 * HOUR, { locale: 'en' });

        expect(store.getSnapshot()).toBe('3 hours ago');
    });

    it('returns a stable snapshot until a tick moves it', () => {
        const store = createRelativeTimeStore(NOW.getTime() - 3 * HOUR, { locale: 'en' });
        const first = store.getSnapshot();

        vi.advanceTimersByTime(MINUTE);

        expect(store.getSnapshot()).toBe(first);
    });

    it('advances through units as time passes', () => {
        const store = createRelativeTimeStore(NOW.getTime(), { locale: 'en' });
        const listener = vi.fn();
        const unsubscribe = store.subscribe(listener);

        expect(store.getSnapshot()).toBe('now');

        vi.advanceTimersByTime(5000);
        expect(store.getSnapshot()).toBe('5 seconds ago');

        vi.advanceTimersByTime(MINUTE);
        expect(store.getSnapshot()).toBe('1 minute ago');

        vi.advanceTimersByTime(HOUR);
        expect(store.getSnapshot()).toBe('1 hour ago');

        vi.advanceTimersByTime(DAY);
        expect(store.getSnapshot()).toBe('yesterday');

        unsubscribe();
    });

    it('notifies only when the text actually changes', () => {
        const store = createRelativeTimeStore(NOW.getTime() - 3 * DAY, { locale: 'en' });
        const listener = vi.fn();
        const unsubscribe = store.subscribe(listener);

        listener.mockClear();

        vi.advanceTimersByTime(6 * HOUR);
        expect(listener).not.toHaveBeenCalled();
        expect(store.getSnapshot()).toBe('3 days ago');

        vi.advanceTimersByTime(20 * HOUR);
        expect(listener).toHaveBeenCalledTimes(1);
        expect(store.getSnapshot()).toBe('4 days ago');

        unsubscribe();
    });

    describe('pacing', () => {
        const delayFor = (offsetMs: number, options: RelativeTimeStoreOptions = {}) => {
            const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

            const store = createRelativeTimeStore(NOW.getTime() + offsetMs, {
                locale: 'en',
                ...options,
            });
            const stop = store.subscribe(() => {});
            const calls = setTimeoutSpy.mock.calls;
            const delay = calls[calls.length - 1]?.[1];

            stop();
            setTimeoutSpy.mockRestore();

            return delay;
        };

        it('sleeps until the displayed number is due to change, not on a grid', () => {
            // 0s reads "now" and turns into "1 second ago" half a second later.
            expect(delayFor(0)).toBe(500);
            // 5 minutes becomes 6 at five and a half.
            expect(delayFor(-5 * MINUTE)).toBe(30_000);
            // 3 hours has a full half hour to run, not the 30 minutes of a grid.
            expect(delayFor(-3 * HOUR - 20 * MINUTE)).toBe(10 * MINUTE);
            // 5 days does not need checking again for twelve hours.
            expect(delayFor(-5 * DAY)).toBe(12 * HOUR);
        });

        it('paces the future the same way it paces the past', () => {
            expect(delayFor(3 * HOUR + 20 * MINUTE)).toBe(50 * MINUTE);
        });

        it('closes in on the crossing for units of no fixed length', () => {
            const delay = delayFor(-40 * DAY);

            expect(delay).toBeGreaterThan(DAY);
            expect(delay).toBeLessThan(30 * DAY);
        });

        it('waits out the "just now" window in one sleep', () => {
            expect(delayFor(-10_000, { justNowSeconds: 45 })).toBe(35_000);
        });

        it('sleeps a whole unit out of a truncated zero, on either side of now', () => {
            expect(delayFor(0, { rounding: 'floor' })).toBe(1000);
            expect(delayFor(400, { rounding: 'floor' })).toBe(1400);
            expect(delayFor(-400, { rounding: 'floor' })).toBe(600);
        });

        it('honours a fixed refresh interval when asked for one', () => {
            expect(delayFor(-5 * DAY, { refreshMs: 5_000 })).toBe(5_000);
        });

        it('caps a very distant timestamp below the setTimeout overflow', () => {
            expect(delayFor(-40 * 365 * DAY)).toBeLessThanOrEqual(2_147_483_647);
        });
    });

    it('stops all timers on unsubscribe', () => {
        const store = createRelativeTimeStore(NOW.getTime(), { locale: 'en' });
        const unsubscribe = store.subscribe(() => {});

        expect(vi.getTimerCount()).toBe(1);

        unsubscribe();

        expect(vi.getTimerCount()).toBe(0);
    });

    it('keeps ticking while any listener remains', () => {
        const store = createRelativeTimeStore(NOW.getTime(), { locale: 'en' });
        const first = vi.fn();
        const second = vi.fn();
        const stopFirst = store.subscribe(first);
        const stopSecond = store.subscribe(second);

        stopFirst();
        vi.advanceTimersByTime(5000);

        expect(second).toHaveBeenCalled();
        expect(store.getSnapshot()).toBe('5 seconds ago');

        stopSecond();
        expect(vi.getTimerCount()).toBe(0);
    });

    describe('background tabs', () => {
        it('suspends updates while hidden and catches up on return', () => {
            const store = createRelativeTimeStore(NOW.getTime(), { locale: 'en' });
            const listener = vi.fn();
            const unsubscribe = store.subscribe(listener);

            setHidden(true);
            expect(vi.getTimerCount()).toBe(0);

            vi.advanceTimersByTime(2 * HOUR);
            listener.mockClear();

            setHidden(false);

            expect(listener).toHaveBeenCalledTimes(1);
            expect(store.getSnapshot()).toBe('2 hours ago');
            expect(vi.getTimerCount()).toBe(1);

            unsubscribe();
        });

        it('attaches one document listener for all stores and detaches with the last', () => {
            const add = vi.spyOn(document, 'addEventListener');
            const remove = vi.spyOn(document, 'removeEventListener');

            const a = createRelativeTimeStore(NOW.getTime(), { locale: 'en' });
            const b = createRelativeTimeStore(NOW.getTime(), { locale: 'en' });
            const stopA = a.subscribe(() => {});
            const stopB = b.subscribe(() => {});

            expect(add.mock.calls.filter(([type]) => type === 'visibilitychange')).toHaveLength(1);

            stopA();
            expect(remove).not.toHaveBeenCalled();

            stopB();
            expect(remove.mock.calls.filter(([type]) => type === 'visibilitychange')).toHaveLength(
                1
            );

            add.mockRestore();
            remove.mockRestore();
        });
    });

    it('never schedules anything for a pinned `now`', () => {
        const store = createRelativeTimeStore(NOW.getTime() - HOUR, {
            locale: 'en',
            now: NOW.getTime(),
        });
        const listener = vi.fn();
        const unsubscribe = store.subscribe(listener);

        expect(store.getSnapshot()).toBe('1 hour ago');
        expect(vi.getTimerCount()).toBe(0);

        vi.advanceTimersByTime(5 * HOUR);

        expect(store.getSnapshot()).toBe('1 hour ago');
        expect(listener).not.toHaveBeenCalled();

        unsubscribe();
    });

    it('does not watch visibility for a pinned `now`, having no timer to suspend', () => {
        const add = vi.spyOn(document, 'addEventListener');

        const store = createRelativeTimeStore(NOW.getTime() - HOUR, {
            locale: 'en',
            now: NOW.getTime(),
        });
        const unsubscribe = store.subscribe(() => {});

        expect(add.mock.calls.filter(([type]) => type === 'visibilitychange')).toHaveLength(0);

        unsubscribe();
        add.mockRestore();
    });

    it('leaves the document alone when visibility tracking is off', () => {
        const add = vi.spyOn(document, 'addEventListener');

        const store = createRelativeTimeStore(NOW.getTime(), {
            locale: 'en',
            trackVisibility: false,
        });
        const listener = vi.fn();
        const unsubscribe = store.subscribe(listener);

        expect(add.mock.calls.filter(([type]) => type === 'visibilitychange')).toHaveLength(0);

        setHidden(true);
        vi.advanceTimersByTime(5000);

        expect(store.getSnapshot()).toBe('5 seconds ago');
        expect(listener).toHaveBeenCalled();

        setHidden(false);
        unsubscribe();
    });

    it('ticks on a fixed interval when given one', () => {
        const store = createRelativeTimeStore(NOW.getTime(), { locale: 'en', refreshMs: 10_000 });
        const listener = vi.fn();
        const unsubscribe = store.subscribe(listener);

        vi.advanceTimersByTime(9_000);
        expect(store.getSnapshot()).toBe('now');

        vi.advanceTimersByTime(1_000);
        expect(store.getSnapshot()).toBe('10 seconds ago');

        unsubscribe();
    });

    describe('getParts', () => {
        it('exposes the decision behind the text', () => {
            const store = createRelativeTimeStore(NOW.getTime() - 3 * HOUR, { locale: 'en' });

            expect(store.getParts()).toEqual({ value: -3, unit: 'hour', text: '3 hours ago' });
        });

        it('keeps one object identity until the text moves', () => {
            const store = createRelativeTimeStore(NOW.getTime() - 3 * DAY, { locale: 'en' });
            const unsubscribe = store.subscribe(() => {});

            const first = store.getParts();

            vi.advanceTimersByTime(6 * HOUR);
            expect(store.getParts()).toBe(first);

            vi.advanceTimersByTime(20 * HOUR);
            expect(store.getParts()).not.toBe(first);
            expect(store.getParts()).toEqual({ value: -4, unit: 'day', text: '4 days ago' });

            unsubscribe();
        });
    });

    it('collapses a fresh timestamp to "now" for the length of the just-now window', () => {
        const store = createRelativeTimeStore(NOW.getTime(), {
            locale: 'en',
            justNowSeconds: 45,
        });
        const unsubscribe = store.subscribe(() => {});

        vi.advanceTimersByTime(30_000);
        expect(store.getSnapshot()).toBe('now');

        vi.advanceTimersByTime(20_000);
        expect(store.getSnapshot()).toBe('50 seconds ago');

        unsubscribe();
    });

    it('rejects an invalid date at creation, not at first read', () => {
        expect(() => createRelativeTimeStore('not a date')).toThrow(TypeError);
    });
});

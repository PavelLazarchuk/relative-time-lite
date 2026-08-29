/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRelativeTimeStore } from '../src/store';

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

    it('paces itself by unit rather than on a fixed interval', () => {
        const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
        const lastDelay = () => {
            const calls = setTimeoutSpy.mock.calls;

            return calls[calls.length - 1]?.[1];
        };

        const seconds = createRelativeTimeStore(NOW.getTime(), { locale: 'en' });
        const stopSeconds = seconds.subscribe(() => {});
        expect(lastDelay()).toBe(1000);
        stopSeconds();

        setTimeoutSpy.mockClear();
        const minutes = createRelativeTimeStore(NOW.getTime() - 5 * MINUTE, { locale: 'en' });
        const stopMinutes = minutes.subscribe(() => {});
        expect(lastDelay()).toBe(30_000);
        stopMinutes();

        setTimeoutSpy.mockClear();
        const days = createRelativeTimeStore(NOW.getTime() - 5 * DAY, { locale: 'en' });
        const stopDays = days.subscribe(() => {});
        expect(lastDelay()).toBe(3_600_000);
        stopDays();

        setTimeoutSpy.mockRestore();
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

    it('rejects an invalid date at creation, not at first read', () => {
        expect(() => createRelativeTimeStore('not a date')).toThrow(TypeError);
    });
});

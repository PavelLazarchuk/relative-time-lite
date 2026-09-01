/**
 * @vitest-environment jsdom
 */
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { relativeTime } from '../src/format';
import { useRelativeTime, useRelativeTimeParts } from '../src/react';
import type { DateInput, RelativeTimeOptions } from '../src/types';

const NOW = new Date('2024-03-15T12:00:00.000Z');

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function Stamp({ date, options }: { date: DateInput; options?: RelativeTimeOptions }) {
    return <span data-testid="stamp">{useRelativeTime(date, options)}</span>;
}

const text = () => screen.getByTestId('stamp').textContent;

describe('useRelativeTime', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
        Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    it('renders the formatted time on first paint', () => {
        render(<Stamp date={NOW.getTime() - 3 * HOUR} options={{ locale: 'en' }} />);

        expect(text()).toBe('3 hours ago');
    });

    it('updates itself as time passes', () => {
        render(<Stamp date={NOW.getTime()} options={{ locale: 'en' }} />);

        expect(text()).toBe('now');

        act(() => void vi.advanceTimersByTime(30_000));
        expect(text()).toBe('30 seconds ago');

        act(() => void vi.advanceTimersByTime(90_000));
        expect(text()).toBe('2 minutes ago');

        act(() => void vi.advanceTimersByTime(HOUR));
        expect(text()).toBe('1 hour ago');
    });

    it('re-renders only when the text changes', () => {
        const renders = vi.fn();

        function Counted() {
            renders();

            return (
                <span data-testid="stamp">
                    {useRelativeTime(NOW.getTime() - 3 * DAY, { locale: 'en' })}
                </span>
            );
        }

        render(<Counted />);
        renders.mockClear();

        act(() => void vi.advanceTimersByTime(6 * HOUR));
        expect(renders).not.toHaveBeenCalled();
        expect(text()).toBe('3 days ago');

        act(() => void vi.advanceTimersByTime(20 * HOUR));
        expect(renders).toHaveBeenCalledTimes(1);
        expect(text()).toBe('4 days ago');
    });

    it('survives re-renders with fresh inline options and Date objects', () => {
        const { rerender } = render(
            <Stamp date={new Date(NOW.getTime() - HOUR)} options={{ locale: ['en'] }} />
        );

        const timers = vi.getTimerCount();

        rerender(<Stamp date={new Date(NOW.getTime() - HOUR)} options={{ locale: ['en'] }} />);
        rerender(<Stamp date={new Date(NOW.getTime() - HOUR)} options={{ locale: ['en'] }} />);

        expect(vi.getTimerCount()).toBe(timers);
        expect(text()).toBe('1 hour ago');
    });

    it('follows the date when it changes', () => {
        const { rerender } = render(
            <Stamp date={NOW.getTime() - HOUR} options={{ locale: 'en' }} />
        );

        expect(text()).toBe('1 hour ago');

        rerender(<Stamp date={NOW.getTime() - 3 * HOUR} options={{ locale: 'en' }} />);

        expect(text()).toBe('3 hours ago');
    });

    it('treats an empty locale list as the runtime default, like the core does', () => {
        render(<Stamp date={NOW.getTime() - 3 * HOUR} options={{ locale: [] }} />);

        expect(text()).toBe(relativeTime(NOW.getTime() - 3 * HOUR, { locale: [] }));
    });

    it('does not rewrite a comma-joined tag into a list, as the core does not', () => {
        const onError = vi.spyOn(console, 'error').mockImplementation(() => {});

        expect(() => relativeTime(NOW.getTime() - DAY, { locale: 'de,en' })).toThrow(RangeError);
        expect(() =>
            render(<Stamp date={NOW.getTime() - DAY} options={{ locale: 'de,en' }} />)
        ).toThrow(RangeError);

        onError.mockRestore();
    });

    it('follows the locale when it changes', () => {
        const { rerender } = render(
            <Stamp date={NOW.getTime() - 3 * HOUR} options={{ locale: 'en' }} />
        );

        expect(text()).toBe('3 hours ago');

        rerender(<Stamp date={NOW.getTime() - 3 * HOUR} options={{ locale: 'ru' }} />);

        expect(text()).toBe('3 часа назад');
    });

    it('tears its timer down on unmount', () => {
        const { unmount } = render(<Stamp date={NOW.getTime()} options={{ locale: 'en' }} />);

        expect(vi.getTimerCount()).toBe(1);

        unmount();

        expect(vi.getTimerCount()).toBe(0);
    });

    it('throws a clear error for an invalid date instead of rendering NaN', () => {
        const onError = vi.spyOn(console, 'error').mockImplementation(() => {});

        expect(() => render(<Stamp date="not a date" />)).toThrow(/^relative-time-lite:/);

        onError.mockRestore();
    });
});

describe('useRelativeTime with no date', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
        Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    function Maybe({ date }: { date: DateInput | null | undefined }) {
        return <span data-testid="stamp">{useRelativeTime(date, { locale: 'en' })}</span>;
    }

    it('renders an empty string instead of throwing', () => {
        render(<Maybe date={null} />);

        expect(text()).toBe('');
        expect(vi.getTimerCount()).toBe(0);
    });

    it('treats undefined the same way', () => {
        render(<Maybe date={undefined} />);

        expect(text()).toBe('');
    });

    it('starts ticking once the date arrives', () => {
        const { rerender } = render(<Maybe date={null} />);

        rerender(<Maybe date={NOW.getTime()} />);
        expect(text()).toBe('now');

        act(() => void vi.advanceTimersByTime(5000));
        expect(text()).toBe('5 seconds ago');

        rerender(<Maybe date={null} />);
        expect(text()).toBe('');
        expect(vi.getTimerCount()).toBe(0);
    });
});

describe('useRelativeTimeParts', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
        Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
    });

    function Parts({ date }: { date: DateInput | null | undefined }) {
        const parts = useRelativeTimeParts(date, { locale: 'en' });

        return <span data-testid="stamp">{parts ? `${parts.value} ${parts.unit}` : 'none'}</span>;
    }

    it('renders the unit and the value, and keeps them current', () => {
        render(<Parts date={NOW.getTime() - 3 * HOUR} />);

        expect(text()).toBe('-3 hour');

        act(() => void vi.advanceTimersByTime(HOUR));
        expect(text()).toBe('-4 hour');
    });

    it('returns null when there is no date', () => {
        render(<Parts date={null} />);

        expect(text()).toBe('none');
    });
});

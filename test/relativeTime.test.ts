import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { relativeTime } from '../src/format';

const NOW = new Date('2024-03-15T12:00:00.000Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const ahead = (ms: number) => new Date(NOW.getTime() + ms);

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('relativeTime', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('input types', () => {
        it('accepts a Date, epoch milliseconds and an ISO string alike', () => {
            const target = ago(2 * HOUR);

            expect(relativeTime(target, { locale: 'en' })).toBe('2 hours ago');
            expect(relativeTime(target.getTime(), { locale: 'en' })).toBe('2 hours ago');
            expect(relativeTime(target.toISOString(), { locale: 'en' })).toBe('2 hours ago');
        });

        it.each([
            ['an unparsable string', 'not a date'],
            ['an invalid Date', new Date('nope')],
            ['NaN', NaN],
            ['Infinity', Infinity],
            ['null', null],
            ['undefined', undefined],
            ['a plain object', { when: 1 }],
        ])('throws a named TypeError for %s', (_label, input) => {
            expect(() => relativeTime(input as never)).toThrow(TypeError);
            expect(() => relativeTime(input as never)).toThrow(/^relative-time-lite:/);
        });

        it('never leaks NaN into the formatted text', () => {
            expect(() => relativeTime('2024-13-45')).toThrow(TypeError);
        });
    });

    describe('direction', () => {
        it('reads the past as past and the future as future', () => {
            expect(relativeTime(ago(5 * MINUTE), { locale: 'en' })).toBe('5 minutes ago');
            expect(relativeTime(ahead(5 * MINUTE), { locale: 'en' })).toBe('in 5 minutes');
            expect(relativeTime(NOW, { locale: 'en' })).toBe('now');
        });
    });

    describe('options', () => {
        it('defaults numeric to auto, which yields the idiomatic wording', () => {
            expect(relativeTime(ago(DAY), { locale: 'en' })).toBe('yesterday');
            expect(relativeTime(ago(DAY), { locale: 'en', numeric: 'always' })).toBe('1 day ago');
        });

        it('passes style through to Intl', () => {
            expect(relativeTime(ago(3 * DAY), { locale: 'en', style: 'long' })).toBe('3 days ago');
            expect(relativeTime(ago(3 * DAY), { locale: 'en', style: 'short' })).toBe('3 days ago');
            expect(relativeTime(ago(3 * DAY), { locale: 'en', style: 'narrow' })).toBe('3d ago');
        });

        it('measures from a pinned `now` instead of the clock', () => {
            const base = '2024-03-15T12:00:00.000Z';

            expect(relativeTime('2024-03-15T09:00:00.000Z', { locale: 'en', now: base })).toBe(
                '3 hours ago'
            );
            expect(
                relativeTime('2024-03-15T09:00:00.000Z', { locale: 'en', now: NOW.getTime() })
            ).toBe('3 hours ago');
        });

        it('rejects an invalid `now` too', () => {
            expect(() => relativeTime(NOW, { now: 'whenever' })).toThrow(TypeError);
        });

        it('accepts a locale fallback list', () => {
            expect(relativeTime(ago(2 * HOUR), { locale: ['xx-nonsense', 'en'] })).toBe(
                '2 hours ago'
            );
        });
    });

    describe('locales', () => {
        it('formats in English', () => {
            expect(relativeTime(ago(3 * HOUR), { locale: 'en' })).toBe('3 hours ago');
            expect(relativeTime(ahead(2 * DAY), { locale: 'en' })).toBe('in 2 days');
        });

        it('formats in Russian, including its plural forms', () => {
            expect(relativeTime(ago(3 * HOUR), { locale: 'ru' })).toBe('3 часа назад');
            expect(relativeTime(ago(5 * HOUR), { locale: 'ru' })).toBe('5 часов назад');
            expect(relativeTime(ago(DAY), { locale: 'ru' })).toBe('вчера');
            expect(relativeTime(ahead(2 * DAY), { locale: 'ru' })).toBe('послезавтра');
        });

        it('formats in German', () => {
            expect(relativeTime(ago(3 * HOUR), { locale: 'de' })).toBe('vor 3 Stunden');
            expect(relativeTime(ago(DAY), { locale: 'de' })).toBe('gestern');
        });

        it('formats in French', () => {
            expect(relativeTime(ago(3 * HOUR), { locale: 'fr' })).toBe('il y a 3 heures');
            expect(relativeTime(ago(DAY), { locale: 'fr' })).toBe('hier');
        });

        it('keeps separate formatters per option set', () => {
            expect(relativeTime(ago(DAY), { locale: 'en', numeric: 'auto' })).toBe('yesterday');
            expect(relativeTime(ago(DAY), { locale: 'en', numeric: 'always' })).toBe('1 day ago');
            expect(relativeTime(ago(DAY), { locale: 'en', numeric: 'auto' })).toBe('yesterday');
        });

        it('does not confuse a locale list with a comma-joined string', () => {
            expect(relativeTime(ago(DAY), { locale: ['de', 'en'] })).toBe('gestern');
            expect(() => relativeTime(ago(DAY), { locale: 'de,en' })).toThrow(RangeError);
        });

        it('stays correct past the formatter cache bound', () => {
            for (let i = 0; i < 200; i += 1) {
                expect(relativeTime(ago(DAY), { locale: `en-u-nu-latn-x-t${i}` })).toBe(
                    'yesterday'
                );
            }

            expect(relativeTime(ago(DAY), { locale: 'de' })).toBe('gestern');
            expect(relativeTime(ago(3 * HOUR), { locale: 'fr' })).toBe('il y a 3 heures');
        });
    });

    describe('calendar units', () => {
        it('reads a clamped month boundary as a month, as documented', () => {
            expect(
                relativeTime('2024-01-31T00:00:00Z', {
                    locale: 'en',
                    now: '2024-02-29T00:00:00Z',
                })
            ).toBe('last month');
        });

        it('names months and years', () => {
            expect(relativeTime('2024-01-15T12:00:00.000Z', { locale: 'en' })).toBe('2 months ago');
            expect(relativeTime('2023-03-15T12:00:00.000Z', { locale: 'en' })).toBe('last year');
            expect(relativeTime('2025-03-15T12:00:00.000Z', { locale: 'en' })).toBe('next year');
        });
    });
});

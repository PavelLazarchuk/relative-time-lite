/**
 * @vitest-environment jsdom
 */
import { act, cleanup } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RelativeTimeProvider, useRelativeTime, useRelativeTimeParts } from '../src/react';
import type { UseRelativeTimeOptions } from '../src/types';

const HOUR = 3_600_000;

const SERVER_NOW = new Date('2024-03-15T12:00:00.000Z');
const CLIENT_NOW = new Date('2024-03-15T13:00:00.000Z');

const STAMP = SERVER_NOW.getTime() - 3 * HOUR;

function Stamp({ options }: { options?: UseRelativeTimeOptions }) {
    return <span data-testid="stamp">{useRelativeTime(STAMP, { locale: 'en', ...options })}</span>;
}

function hydrate(html: string, node: React.ReactNode) {
    const container = document.createElement('div');

    container.innerHTML = html;
    document.body.append(container);

    const recovered: unknown[] = [];
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

    act(() => {
        hydrateRoot(container, node, { onRecoverableError: error => void recovered.push(error) });
    });

    errors.mockRestore();

    const mismatches = recovered.filter(error => /hydrat/i.test(String(error)));

    return { container, mismatches };
}

describe('hydration', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(SERVER_NOW);
        Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
        document.body.innerHTML = '';
    });

    it('reports a mismatch when the clock moves between the two renders', () => {
        const html = renderToString(<Stamp />);

        expect(html).toContain('3 hours ago');

        vi.setSystemTime(CLIENT_NOW);

        const { container, mismatches } = hydrate(html, <Stamp />);

        expect(mismatches.length).toBeGreaterThan(0);
        expect(container.textContent).toBe('4 hours ago');
    });

    it('renders `hydrationText` on the server and goes live after hydration', () => {
        const options = { hydrationText: '' };
        const html = renderToString(<Stamp options={options} />);

        expect(html).not.toContain('ago');

        vi.setSystemTime(CLIENT_NOW);

        const { container, mismatches } = hydrate(html, <Stamp options={options} />);

        expect(mismatches).toEqual([]);
        expect(container.textContent).toBe('4 hours ago');
    });

    it('measures the server pass from `serverNow`, so the markup keeps real text', () => {
        const options = { serverNow: SERVER_NOW };
        const html = renderToString(<Stamp options={options} />);

        expect(html).toContain('3 hours ago');

        vi.setSystemTime(CLIENT_NOW);

        const { container, mismatches } = hydrate(html, <Stamp options={options} />);

        expect(mismatches).toEqual([]);
        expect(container.textContent).toBe('4 hours ago');
    });

    it('takes both halves from the provider, and lets a call override them', () => {
        const tree = (
            <RelativeTimeProvider now={SERVER_NOW} hydrationText="…">
                <Stamp />
                <Stamp options={{ serverNow: SERVER_NOW }} />
            </RelativeTimeProvider>
        );

        const html = renderToString(tree);

        expect(html).toContain('…');
        expect(html).toContain('3 hours ago');

        vi.setSystemTime(CLIENT_NOW);

        const { container, mismatches } = hydrate(html, tree);

        expect(mismatches).toEqual([]);
        expect(container.textContent).toBe('4 hours ago4 hours ago');
    });

    it('takes the provider as a whole or not at all', () => {
        const tree = (
            <RelativeTimeProvider now={SERVER_NOW} hydrationText="…">
                <Stamp options={{ serverNow: SERVER_NOW }} />
            </RelativeTimeProvider>
        );

        expect(renderToString(tree)).toContain('3 hours ago');
    });

    it('prefers `hydrationText` when a call asks for both', () => {
        const options = { hydrationText: '—', serverNow: SERVER_NOW };

        expect(renderToString(<Stamp options={options} />)).toContain('—');
    });

    it('keeps the parts hook on the same snapshot', () => {
        function Parts() {
            const parts = useRelativeTimeParts(STAMP, { locale: 'en', serverNow: SERVER_NOW });

            return <span>{`${parts.unit}:${parts.text}`}</span>;
        }

        const html = renderToString(<Parts />);

        expect(html).toContain('hour:3 hours ago');

        vi.setSystemTime(CLIENT_NOW);

        const { container, mismatches } = hydrate(html, <Parts />);

        expect(mismatches).toEqual([]);
        expect(container.textContent).toBe('hour:4 hours ago');
    });

    it('stays empty for a missing date whatever the hydration options say', () => {
        function Missing() {
            return <span>{useRelativeTime(null, { locale: 'en', hydrationText: 'x' })}</span>;
        }

        const html = renderToString(<Missing />);

        expect(html).not.toContain('x');

        const { container, mismatches } = hydrate(html, <Missing />);

        expect(mismatches).toEqual([]);
        expect(container.textContent).toBe('');
    });
});

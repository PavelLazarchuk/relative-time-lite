export type DateInput = Date | number | string;

export type RelativeTimeUnit = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';

export interface RelativeTimeParts {
    value: number;
    unit: RelativeTimeUnit;
}

export interface RelativeTimeResult extends RelativeTimeParts {
    text: string;
}

export interface RelativeTimeFormatInput extends RelativeTimeParts {
    date: number;
    now: number;
}

export type RelativeTimeFormatter = (input: RelativeTimeFormatInput) => string | undefined;

export interface SelectUnitOptions {
    minUnit?: RelativeTimeUnit;
    maxUnit?: RelativeTimeUnit;
    rounding?: 'round' | 'floor';
    justNowSeconds?: number;
}

export interface RelativeTimeOptions extends SelectUnitOptions {
    locale?: string | readonly string[];
    style?: 'long' | 'short' | 'narrow';
    numeric?: 'always' | 'auto';
    justNowText?: string;
    format?: RelativeTimeFormatter;
    now?: DateInput;
}

export interface RelativeTimeStoreOptions extends RelativeTimeOptions {
    refreshMs?: number;
    trackVisibility?: boolean;
}

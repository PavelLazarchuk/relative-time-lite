import { readFile } from 'node:fs/promises';
import { dirname, join, normalize } from 'node:path';

const SPECIFIER = /(?:from\s*|import\s*|require\(\s*)['"]([^'"]+)['"]/g;

async function specifiersReachableFrom(entry) {
    const seen = new Set();
    const external = new Set();
    const queue = [normalize(entry)];

    while (queue.length) {
        const file = queue.pop();

        if (seen.has(file)) continue;
        seen.add(file);

        const code = await readFile(file, 'utf8');

        for (const [, specifier] of code.matchAll(SPECIFIER)) {
            if (specifier.startsWith('.')) queue.push(normalize(join(dirname(file), specifier)));
            else external.add(specifier);
        }
    }

    return { files: seen, external };
}

let failed = false;

for (const entry of ['dist/index.js', 'dist/index.cjs']) {
    const { files, external } = await specifiersReachableFrom(entry);
    const react = [...external].filter(name => name === 'react' || name.startsWith('react/'));

    if (react.length) {
        console.error(
            `${entry} reaches React via ${react.join(', ')} (${files.size} file(s) scanned)`
        );
        failed = true;
    } else {
        console.log(`${entry}: React-free across ${files.size} file(s).`);
    }
}

for (const entry of ['dist/react/index.js', 'dist/react/index.cjs']) {
    const code = await readFile(entry, 'utf8');

    if (!/['"]react['"]/.test(code)) {
        console.error(`${entry} does not import React — it should be external, not bundled.`);
        failed = true;
    }
}

if (failed) process.exit(1);

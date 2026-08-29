import { readFile, writeFile } from 'node:fs/promises';

const DIRECTIVE = `'use client';`;
const ENTRIES = ['dist/react/index.js', 'dist/react/index.cjs'];

let count = 0;

for (const file of ENTRIES) {
    const code = await readFile(file, 'utf8');

    if (code.startsWith(DIRECTIVE)) continue;

    await writeFile(file, DIRECTIVE + '\n' + code);
    count += 1;
}

console.log(`add-use-client: marked ${count} entry file(s) as client modules.`);

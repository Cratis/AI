import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

function check(pages, key) {
    const seen = new Set();
    return pages.map(({ isSuccess, data }, i) => {
        if (isSuccess !== true || !Array.isArray(data) || !data.length) throw Error(`Page ${i + 1} has no successful, nonempty result`);
        for (const row of data) {
            const id = row?.[key];
            if (typeof id !== 'string' && !Number.isFinite(id)) throw Error(`Page ${i + 1} lacks scalar key ${key}`);
            if (seen.has(id)) throw Error(`Repeated key within or across pages at page ${i + 1}`);
            seen.add(id);
        }
        return data.length;
    });
}

try {
    const [first, second, key] = process.argv.slice(2);
    if (first === '--self-test') {
        const page = id => ({ isSuccess: true, data: [{ id }] });
        assert.deepEqual(check([page(1), page(2)], 'id'), [1, 1]);
        assert.throws(() => check([page(1), page(1)], 'id'), /Repeated key/);
    } else {
        if (!first || !second || !key) throw Error('Usage: check-pages.mjs first.json second.json key');
        const pages = await Promise.all([first, second].map(async path => {
            const text = await readFile(path, 'utf8');
            try { return JSON.parse(text); } catch { throw Error(`Invalid JSON file: ${path}`); }
        }));
        console.log('Distinct rows per page:', ...check(pages, key));
    }
} catch (error) { console.error(error.message); process.exitCode = 1; }

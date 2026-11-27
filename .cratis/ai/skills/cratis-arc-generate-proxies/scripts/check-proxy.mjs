import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

function check(output, text, member) {
    if (!output.trim()) throw Error('CratisProxiesOutputPath is empty in Debug');
    if (!text.includes(member)) throw Error('Expected contract text absent; check the assembly and regenerate the proxy');
}
try {
    const [project, file, member] = process.argv.slice(2);
    if (project === '--self-test') {
        check('generated', 'export class Book', 'class Book');
        assert.throws(() => check('', '', 'Book'), /empty/);
        assert.throws(() => check('generated', 'Book', 'Return'), /absent/);
    } else {
        if (!project || !file || !member) throw Error('Usage: check-proxy.mjs backend.csproj relative-proxy.ts expected-text');
        const output = execFileSync('dotnet', ['msbuild', resolve(project), '-nologo', '-p:Configuration=Debug', '-getProperty:CratisProxiesOutputPath'], {encoding:'utf8'}).trim();
        if (!output) throw Error('CratisProxiesOutputPath is empty in Debug');
        const path = resolve(dirname(project), output, file);
        check(output, await readFile(path, 'utf8'), member);
        console.log(`Expected contract text present in ${path}`);
    }
} catch (error) { console.error(error.message); process.exitCode = 1; }

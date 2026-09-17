// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Compiles skill-examples.play — a model assembled from the examples in the
// cratis-screenplay-* skills — with the real Screenplay compiler, then plants
// known defects and requires every one of them to be detected.
//
// A green compile over a model that exercises nothing proves nothing, so the
// self-test is not optional: without it this check could pass while the
// compiler had stopped reporting anything at all.
//
// Exit codes follow the corpus convention: 0 ran clean, 1 found defects,
// 2 could not run. Could-not-run is never reported as a pass.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const model = join(here, 'skill-examples.play');

// Every defect below is one a cratis-screenplay-* skill explicitly warns about.
// `find` must appear verbatim in the model, or the planting silently no-ops —
// which is exactly the vacuous pass this file exists to prevent.
const plantedDefects = [
    {
        name: 'a second identifier on one command',
        find: '        customerId     CustomerId\n',
        replace: '        customerId     CustomerId identifier\n',
    },
    {
        name: 'identifier on an event property',
        find: '      event InvoiceRegistered\n        tag "billing"',
        replace: '      event InvoiceRegistered identifier\n        tag "billing"',
    },
    {
        name: 'an unknown slice type',
        find: 'slice StateView SiteStats',
        replace: 'slice Wat SiteStats',
    },
    {
        name: 'a read model built twice',
        find: 'projection InvoiceDetails => InvoiceDetailsReadModel',
        replace: 'projection InvoiceDetails => InvoiceListReadModel',
    },
    {
        name: 'mixed or/and in one capture when clause',
        find: '          when status from "sent" to "cancelled"',
        replace: '          when status or id and lineNumber',
    },
    {
        name: 'an effect outdented out of its reaction trigger',
        find: '          invokes CancelInvoice\n            invoiceId = repository',
        replace: '        invokes CancelInvoice\n          invoiceId = repository',
    },
];

function resolveCompiler() {
    const explicit = process.env.SCREENPLAY_TOOL;
    if (explicit) {
        return explicit.endsWith('.dll') ? ['dotnet', [explicit]] : [explicit, []];
    }
    try {
        execFileSync('screenplay', ['--no-color'], { stdio: 'ignore', cwd: here });
        return ['screenplay', []];
    } catch (error) {
        // A non-zero exit still proves the binary is on PATH and runnable; only
        // a spawn failure means it is genuinely absent.
        return error.code === 'ENOENT' ? null : ['screenplay', []];
    }
}

function compile(compiler, path) {
    const [command, leadingArguments] = compiler;
    try {
        const stdout = execFileSync(command, [...leadingArguments, path, '--no-color', '--warnaserror'], {
            encoding: 'utf8',
        });
        return { code: 0, output: stdout };
    } catch (error) {
        if (error.code === 'ENOENT') throw error;
        return { code: error.status ?? 1, output: `${error.stdout ?? ''}${error.stderr ?? ''}` };
    }
}

const compiler = resolveCompiler();
if (!compiler) {
    console.error(
        'SKIPPED: the Screenplay compiler is not available, so the skill examples were NOT compiled.\n' +
            'This is a could-not-run, not a pass. Install it with\n' +
            '  dotnet tool install -g Cratis.Screenplay.Tool\n' +
            'or point SCREENPLAY_TOOL at a locally built Cratis.Screenplay.Tool.dll.',
    );
    process.exit(2);
}

const failures = [];
const source = readFileSync(model, 'utf8');

const clean = compile(compiler, model);
if (clean.code !== 0) {
    failures.push(`skill-examples.play must compile with zero errors and zero warnings:\n${clean.output}`);
}

const workspace = mkdtempSync(join(tmpdir(), 'screenplay-examples-'));
try {
    for (const defect of plantedDefects) {
        if (!source.includes(defect.find)) {
            failures.push(`planting '${defect.name}' matched nothing — the anchor has drifted and the defect was never planted.`);
            continue;
        }
        const planted = join(workspace, 'planted.play');
        writeFileSync(planted, source.replace(defect.find, defect.replace));
        const result = compile(compiler, planted);
        if (result.code === 0) {
            failures.push(`planting '${defect.name}' was NOT detected — this check can pass vacuously.`);
        }
    }
} finally {
    rmSync(workspace, { recursive: true, force: true });
}

if (failures.length > 0) {
    console.error(`${failures.length} failure(s):\n\n${failures.join('\n\n')}`);
    process.exit(1);
}

const lines = source.split('\n').length;
console.log(
    `passed: skill-examples.play (${lines} lines) compiles clean with --warnaserror, ` +
        `and all ${plantedDefects.length} planted defects were detected.`,
);

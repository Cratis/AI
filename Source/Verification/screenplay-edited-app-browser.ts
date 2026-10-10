// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Runs a Screenplay model folder with the installed `cratis run` and checks, in a real browser, that the column an
// AI agent added through the MCP transcript (`screenplay-mcp-transcript.ts --edit work-item-id-column`) is on the
// WorkItemList screen and shows the created work item's id. Requires Docker and a resolvable `playwright`
// (NODE_PATH or SCREENPLAY_PLAYWRIGHT_NODE_PATH). Exit codes: 0 verified, 1 the edit is not visible, 2 could not run.

import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';

interface PlaywrightPage {
    goto(url: string, options: { waitUntil: string; timeout: number }): Promise<unknown>;
    getByRole(role: string, options: { name: RegExp }): { first(): { waitFor(options: { timeout: number }): Promise<void> } };
    getByText(text: string, options: { exact: boolean }): { first(): { waitFor(options: { timeout: number }): Promise<void> } };
}

interface PlaywrightBrowser {
    newPage(): Promise<PlaywrightPage>;
    close(): Promise<void>;
}

interface Check {
    name: string;
    passed: boolean;
    detail: string;
}

const args = new Map<string, string>();
for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index];
    const value = process.argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) {
        console.error(`Invalid argument at ${index}: expected --name value`);
        process.exit(2);
    }
    args.set(key.slice(2), value);
}

const model = resolve(args.get('model') ?? '');
const port = Number(args.get('port') ?? '19121');
const workbenchPort = Number(args.get('workbench-port') ?? '35121');
const baseUrl = `http://localhost:${port}`;
const editedDocument = join(model, 'Workspaces', 'Tracking', 'WorkItemList', 'WorkItemList.play');

function couldNotRun(reason: string): never {
    console.error(`screenplay-edited-app-browser: could not run: ${reason}`);
    process.exit(2);
}

if (!existsSync(editedDocument)) couldNotRun(`${editedDocument} does not exist; pass --model <MCP-edited model folder>`);
if (!readFileSync(editedDocument, 'utf8').includes('column workItemId label "Work item id"')) {
    couldNotRun('the model has no "Work item id" column; run screenplay-mcp-transcript.ts --edit work-item-id-column first');
}

const nodePath = process.env.SCREENPLAY_PLAYWRIGHT_NODE_PATH ?? process.env.NODE_PATH ?? '';
let chromium: { launch(options: { headless: boolean }): Promise<PlaywrightBrowser> };
try {
    const resolver = createRequire(join(nodePath.split(':')[0] || process.cwd(), 'resolver.js'));
    chromium = (resolver('playwright') as { chromium: typeof chromium }).chromium;
} catch {
    couldNotRun('playwright is not resolvable; set SCREENPLAY_PLAYWRIGHT_NODE_PATH to a node_modules folder that has it');
}

function read(command: string, commandArgs: string[]): string | null {
    try {
        return execFileSync(command, commandArgs, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    } catch {
        return null;
    }
}

const sleep = (milliseconds: number) => new Promise(done => setTimeout(done, milliseconds));

// Only the container published on this port that mounts this model folder is ours to remove.
function ownContainer(): string | null {
    const listing = read('docker', ['ps', '-a', '--filter', `publish=${port}`, '--format', '{{.ID}}']) ?? '';
    for (const id of listing.split('\n').filter(Boolean)) {
        const mounts = read('docker', ['inspect', '-f', '{{range .Mounts}}{{.Source}} {{end}}', id]) ?? '';
        if (mounts.includes(model)) return id;
    }
    return null;
}

async function waitForReady(runtime: ChildProcess) {
    const deadline = Date.now() + 180_000;
    while (Date.now() < deadline) {
        if (runtime.exitCode !== null) couldNotRun(`cratis run exited before readiness with code ${runtime.exitCode}`);
        try {
            if ((await fetch(`${baseUrl}/index.html`)).ok) return;
        } catch {
            // The runtime has not bound the port yet.
        }
        await sleep(1_000);
    }
    couldNotRun(`timed out waiting for ${baseUrl}/index.html`);
}

async function main() {
    const runtime = spawn('cratis', ['run', model, '--port', String(port), '--workbench-port', String(workbenchPort), '--yes'], {
        stdio: ['ignore', 'ignore', 'pipe']
    });
    let runtimeErrors = '';
    runtime.stderr?.on('data', (chunk: Buffer) => { runtimeErrors += chunk.toString('utf8'); });

    const checks: Check[] = [];
    let browser: PlaywrightBrowser | undefined;
    try {
        await waitForReady(runtime);
        const container = ownContainer();
        const stageImage = container ? read('docker', ['inspect', '-f', '{{.Config.Image}}', container]) : null;

        const workItemId = randomUUID();
        const title = `AI edited column ${workItemId.slice(0, 8)}`;
        const created = await fetch(`${baseUrl}/api/workspaces/tracking/create-work-item/create-work-item`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ workItemId, title })
        });
        checks.push({ name: 'command.createWorkItem', passed: created.ok, detail: String(created.status) });

        browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(`${baseUrl}/#/WorkItemList`, { waitUntil: 'domcontentloaded', timeout: 30_000 });

        const expectVisible = async (name: string, wait: () => Promise<void>, detail: string) => {
            try {
                await wait();
                checks.push({ name, passed: true, detail });
            } catch {
                checks.push({ name, passed: false, detail: `not visible: ${detail}` });
            }
        };

        await expectVisible('table.existingColumn.Title', () => page.getByRole('columnheader', { name: /^Title$/ }).first().waitFor({ timeout: 20_000 }), 'Title');
        await expectVisible('table.editedColumn.header', () => page.getByRole('columnheader', { name: /^Work item id$/ }).first().waitFor({ timeout: 20_000 }), 'Work item id');
        await expectVisible('table.createdRow.title', () => page.getByText(title, { exact: false }).first().waitFor({ timeout: 20_000 }), title);
        await expectVisible('table.editedColumn.value', () => page.getByText(workItemId, { exact: false }).first().waitFor({ timeout: 20_000 }), workItemId);

        const passed = checks.every(check => check.passed);
        console.log(JSON.stringify({ status: passed ? 'passed' : 'failed', cli: read('cratis', ['--version']), stageImage, model, checks }, null, 2));
        process.exitCode = passed ? 0 : 1;
    } finally {
        await browser?.close();
        runtime.kill('SIGINT');
        await sleep(3_000);
        const container = ownContainer();
        if (container) read('docker', ['rm', '-f', container]);
        if (process.exitCode === 2 && runtimeErrors.trim()) console.error(runtimeErrors.trim().split('\n').slice(-15).join('\n'));
    }
}

main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
});

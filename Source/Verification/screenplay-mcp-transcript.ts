// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

interface JsonRpcResponse {
    id?: number;
    result?: { content?: { text?: string }[]; tools?: { name: string }[] };
    error?: { code: number; message: string; data?: unknown };
}

interface WorkspaceResult {
    sourceSuccess: boolean;
    semanticSuccess: boolean;
    executableReady: boolean;
    diagnosticCount?: number;
    revision: string;
    catalogRevision: string;
}

interface DocumentsResult {
    page: { items: { documentId: string; path: string }[] };
}

interface ProposalResult {
    success: boolean;
    proposalId?: string;
    failureKind?: string;
    conflicts?: unknown[];
}

interface ApplyResult {
    success: boolean;
    revision?: string;
    failureKind?: string;
    message?: string;
}

type Pending = {
    resolve: (response: JsonRpcResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
};

const args = new Map<string, string>();
for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index];
    const value = process.argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) {
        throw new Error(`Invalid argument at ${index}: expected --name value`);
    }
    args.set(key.slice(2), value);
}

const corpus = resolve(args.get('corpus') ?? process.env.SCREENPLAY_MCP_CORPUS ?? '');
if (!corpus || !existsSync(corpus)) {
    throw new Error('Pass --corpus <folder> or set SCREENPLAY_MCP_CORPUS to the Screenplay canonical source folder');
}

const scratch = resolve(args.get('scratch') ?? process.env.SCREENPLAY_MCP_SCRATCH ?? '.ai-work/screenplay-mcp-transcript');
const cliProject = args.get('cli-project') ?? process.env.SCREENPLAY_CLI_PROJECT;
const serverCommand = args.get('server-command') ?? process.env.SCREENPLAY_MCP_SERVER_COMMAND;
// Opt-in application edit, made in the same proposal as the comment probe: add a column to the WorkItemList table so
// the edited application can be rendered, run and checked in a browser. The default transcript stays comment-only.
const editTableColumn = (args.get('edit') ?? process.env.SCREENPLAY_MCP_EDIT) === 'work-item-id-column';
const editedDocumentPath = 'Workspaces/Tracking/WorkItemList/WorkItemList.play';
const editedColumnAnchor = '              column status label "Status"\n';
const editedColumn = '              column workItemId label "Work item id"\n';

rmSync(scratch, { recursive: true, force: true });
mkdirSync(scratch, { recursive: true });
cpSync(corpus, scratch, { recursive: true });

const command = cliProject
    ? { executable: 'dotnet', args: ['run', '--project', cliProject, '--', 'screenplay', 'mcp', scratch] }
    : serverCommand
        ? { executable: serverCommand, args: [scratch] }
        : { executable: 'cratis', args: ['screenplay', 'mcp', scratch] };

const child = spawn(command.executable, command.args, { stdio: ['pipe', 'pipe', 'pipe'] });
let buffer = '';
let nextId = 1;
let requestCount = 0;
let responseCount = 0;
let stderr = '';
const pending = new Map<number, Pending>();

child.stdout.on('data', (chunk: Buffer) => {
    buffer += chunk.toString('utf8');
    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf('\n');
        if (!line) continue;

        const message = JSON.parse(line) as JsonRpcResponse;
        if (message.id !== undefined && pending.has(message.id)) {
            const waiter = pending.get(message.id)!;
            clearTimeout(waiter.timeout);
            pending.delete(message.id);
            responseCount++;
            waiter.resolve(message);
        }
    }
});

child.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString('utf8');
});

function request(method: string, params: unknown, timeoutMs = 180_000): Promise<JsonRpcResponse> {
    const id = nextId++;
    requestCount++;
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            pending.delete(id);
            reject(new Error(`Timed out waiting for ${method}`));
        }, timeoutMs);
        pending.set(id, { resolve, reject, timeout });
    });
}

function notify(method: string, params: unknown) {
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`);
}

function parseToolResult<T>(response: JsonRpcResponse): T {
    if (response.error) {
        throw new Error(`${response.error.message}: ${JSON.stringify(response.error.data)}`);
    }
    const text = response.result?.content?.[0]?.text;
    if (!text) throw new Error('Tool response did not contain text content');
    return JSON.parse(text) as T;
}

function assertCondition(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}

async function callTool<T>(name: string, toolArgs: Record<string, unknown>): Promise<T> {
    return parseToolResult<T>(await request('tools/call', { name, arguments: toolArgs }));
}

async function main() {
    await request('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'cratis-ai-screenplay-mcp-transcript', version: '1.0.0' }
    });
    notify('notifications/initialized', {});

    const tools = await request('tools/list', {});
    const toolNames = new Set(tools.result?.tools?.map(_ => _.name) ?? []);
    for (const required of ['open-workspace', 'read-workspace', 'propose-source', 'read-proposal', 'apply']) {
        assertCondition(toolNames.has(required), `MCP server did not expose ${required}`);
    }

    const open = await callTool<WorkspaceResult>('open-workspace', {});
    assertCondition(open.sourceSuccess, 'workspace source did not open cleanly');
    assertCondition(open.semanticSuccess, 'workspace semantic model did not bind cleanly');
    assertCondition(open.executableReady, 'workspace executable model was not ready');

    const documents = await callTool<DocumentsResult>('read-workspace', {
        expectedRevision: open.revision,
        view: 'documents',
        offset: 0,
        limit: 20
    });
    const application = documents.page.items.find(_ => _.path === 'application.play');
    assertCondition(application, 'application.play was not found in the workspace document list');

    const sourcePath = join(scratch, 'application.play');
    const comment = '// AI MCP transcript comment preservation probe';
    const source = readFileSync(sourcePath, 'utf8');
    const changedSource = `${comment}\n${source}`;
    const replacements = [{ operation: 'replace-document', documentId: application.documentId, source: changedSource }];

    const editedSourcePath = join(scratch, editedDocumentPath);
    if (editTableColumn) {
        const editedDocument = documents.page.items.find(_ => _.path === editedDocumentPath);
        assertCondition(editedDocument, `${editedDocumentPath} was not found in the workspace document list`);
        const tableSource = readFileSync(editedSourcePath, 'utf8');
        assertCondition(tableSource.includes(editedColumnAnchor), `${editedDocumentPath} no longer has the Status column the edit anchors on`);
        assertCondition(!tableSource.includes(editedColumn), `${editedDocumentPath} already has the column this edit adds`);
        replacements.push({
            operation: 'replace-document',
            documentId: editedDocument.documentId,
            source: tableSource.replace(editedColumnAnchor, `${editedColumnAnchor}${editedColumn}`)
        });
    }

    const proposal = await callTool<ProposalResult>('propose-source', {
        expectedRevision: open.revision,
        expectedCatalogRevision: open.catalogRevision,
        formatting: 'CanonicalizeTouchedDocuments',
        validation: 'Executable',
        includeContent: false,
        documents: replacements
    });
    assertCondition(proposal.success, `proposal was not accepted: ${JSON.stringify(proposal)}`);
    assertCondition(proposal.proposalId, 'proposal did not return an id');

    const proposalChanges = await callTool<unknown>('read-proposal', {
        proposalId: proposal.proposalId,
        view: 'changes',
        offset: 0,
        limit: 200
    });

    const staleApply = await callTool<ApplyResult>('apply', {
        proposalId: proposal.proposalId,
        expectedRevision: `${open.revision.slice(0, -1)}x`,
        expectedCatalogRevision: open.catalogRevision,
        includeContent: false
    });
    assertCondition(!staleApply.success && staleApply.failureKind === 'StaleRevision', 'stale apply did not fail closed');

    const applied = await callTool<ApplyResult>('apply', {
        proposalId: proposal.proposalId,
        expectedRevision: open.revision,
        expectedCatalogRevision: open.catalogRevision,
        includeContent: false
    });
    assertCondition(applied.success, `apply failed: ${JSON.stringify(applied)}`);

    const reopened = await callTool<WorkspaceResult>('open-workspace', {});
    const finalSource = readFileSync(sourcePath, 'utf8');
    assertCondition(reopened.revision !== open.revision, 'revision did not change after apply');
    assertCondition(finalSource.includes(comment), 'comment was not preserved on disk after apply');
    assertCondition(reopened.executableReady, 'workspace was not executable-ready after the apply');
    const columnAdded = editTableColumn && readFileSync(editedSourcePath, 'utf8').includes('column workItemId label "Work item id"');
    if (editTableColumn) assertCondition(columnAdded, 'the work item id column was not on disk after apply');

    const summary = {
        server: `${command.executable} ${command.args.join(' ')}`,
        corpus,
        scratch,
        requestCount,
        responseCount,
        tools: toolNames.size,
        opened: {
            sourceSuccess: open.sourceSuccess,
            semanticSuccess: open.semanticSuccess,
            executableReady: open.executableReady,
            diagnosticCount: open.diagnosticCount
        },
        proposal: {
            success: proposal.success,
            proposalId: proposal.proposalId,
            changesMentionComment: JSON.stringify(proposalChanges).includes(comment)
        },
        staleApply: {
            success: staleApply.success,
            failureKind: staleApply.failureKind,
            message: staleApply.message
        },
        apply: { success: applied.success },
        reopened: {
            sourceSuccess: reopened.sourceSuccess,
            semanticSuccess: reopened.semanticSuccess,
            executableReady: reopened.executableReady,
            revisionChanged: reopened.revision !== open.revision,
            commentPreserved: finalSource.includes(comment)
        },
        edit: editTableColumn ? { document: editedDocumentPath, columnAdded } : null
    };

    console.log(JSON.stringify(summary, null, 2));
}

main()
    .then(() => child.kill())
    .catch(error => {
        child.kill();
        if (stderr.trim()) console.error(stderr.trim().split('\n').slice(-20).join('\n'));
        console.error(error instanceof Error ? error.message : String(error));
        process.exitCode = 1;
    });

#!/usr/bin/env node
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
//
// The permission-prompt tool a worker container's Claude CLI session hands its `ask` decisions to,
// wired in by entrypoint.sh with `--permission-prompt-tool mcp__direct_approval__approve_permission`.
//
// Why it exists: a cloned repository's `.claude/settings.json` may carry `permissions.ask` rules
// meant for a person at an interactive terminal - the managed Cratis corpus asks before
// `git push` and `gh pr` (.cratis/ai/hooks/settings.template.json). In `claude -p`, an `ask` rule
// wins over --dangerously-skip-permissions, and with nobody to answer, the call is denied and the
// worker stops with "blocked waiting on Bash permission approval". A headless CLI routes exactly
// those prompts to the tool named by --permission-prompt-tool, so this server answers them on the
// session's behalf: the container is the sandbox, and approving everything is the same decision
// --dangerously-skip-permissions already expresses.
//
// What it does not override: `deny` rules (including the image's managed `Agent` deny) and
// PreToolUse hooks that deny are settled before any prompt is raised, so they still refuse the call.
// The repository's settings keep loading in full - its CLAUDE.md, skills and hooks included -
// which is why the harness answers the prompt rather than dropping the project setting source
// (`--setting-sources user` also stops project CLAUDE.md and skills from loading).
//
// stdout is the JSON-RPC transport; every approval is logged to stderr, never to stdout.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

/**
 * Builds the permission decision for one prompt: allow it, with the tool's input passed through
 * unchanged.
 * @param {{ tool_name?: string, input?: Record<string, unknown> }} args The prompt the CLI raised.
 * @returns {{ behavior: 'allow', updatedInput: Record<string, unknown> }}
 */
export function approve(args) {
    return { behavior: 'allow', updatedInput: args?.input ?? {} };
}

/**
 * Creates the MCP server exposing the `approve_permission` tool - not yet connected to a transport.
 * @param {{ log?: (line: string) => void }} [options] Where approvals are logged; stderr by default.
 * @returns {McpServer}
 */
export function createServer(options) {
    const log = options?.log ?? ((line) => console.error(line));
    const server = new McpServer({ name: 'direct-approval', version: '1.0.0' });

    server.registerTool(
        'approve_permission',
        {
            description:
                'Used by the worker harness to answer permission prompts in a headless session. ' +
                'Do not call it yourself - it changes nothing.',
            inputSchema: {
                tool_name: z.string(),
                input: z.record(z.string(), z.unknown()),
                tool_use_id: z.string().optional(),
            },
        },
        async (args) => {
            log(`[headless-approval-mcp-server] Approved a permission prompt for ${args.tool_name}`);
            return { content: [{ type: 'text', text: JSON.stringify(approve(args)) }] };
        },
    );

    return server;
}

async function main() {
    await createServer().connect(new StdioServerTransport());
}

// Only run the server when executed directly, so the test can import `approve` and `createServer`.
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        console.error('[headless-approval-mcp-server] Fatal error, exiting:', error);
        process.exit(1);
    });
}

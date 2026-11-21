// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import type { ClaimedSession } from './ClaimedSession.ts';
import type { ReleaseOutcome, WorkPayload } from './DirectContract.ts';
import { connectDirect } from './DirectGateway.ts';
import { DirectLinkDependencies, runDirectLink } from './DirectLinkCommand.ts';
import { EnvironmentSource, isLaunchedSession } from './Environment.ts';
import { Clock, systemClock } from './HeartbeatLoop.ts';
import { LaunchDependencies, claimLaunchedWork } from './LaunchFlow.ts';
import { nodeProofFileSystem } from './LaunchProofReader.ts';
import type { ProofReaderEnvironment } from './LaunchProofReader.ts';
import { describeRefusal } from './Refusals.ts';
import { CommandRunner, spawnRunner } from './SecretStore.ts';
import { WriteGuard } from './WriteGuard.ts';

export const FinishTool = 'direct_session_finish';
const workMessageType = 'direct-work';

export interface ExtensionEnvironment {
    readonly env: EnvironmentSource;
    readonly platform: string;
    readonly uid: number;
    readonly runner: CommandRunner;
    readonly clock: Clock;
    readonly connect: LaunchDependencies['connect'];
}

function describeWork(payload: WorkPayload): string {
    return [
        `You were launched by Cratis Direct to do this work: ${payload.title}`,
        payload.repository ? `Repository: ${payload.repository}${payload.baseRef ? ` (base ${payload.baseRef})` : ''}` : '',
        payload.brief,
        `When you are done, call ${FinishTool} with the outcome (Delivered, Abandoned, Blocked or Declined).`
    ].filter(Boolean).join('\n\n');
}

/** Builds the extension for an environment; the default export wires the real one. */
export function createExtension(extensionEnvironment: ExtensionEnvironment): (pi: ExtensionAPI) => void {
    return pi => {
        const guard = new WriteGuard(new Set([FinishTool]));
        const shutdown = new AbortController();
        let session: ClaimedSession | undefined;
        let announced = false;
        const link: DirectLinkDependencies = { ...extensionEnvironment, session: () => session };

        const start = async (context: ExtensionContext): Promise<void> => {
            if (shutdown.signal.aborted) return;
            const notify = (message: string): void => { if (context.hasUI) context.ui.notify(message, 'warning'); };
            const proofReader: ProofReaderEnvironment = { fileSystem: nodeProofFileSystem, uid: extensionEnvironment.uid, platform: extensionEnvironment.platform, cwd: context.cwd };
            try {
                const claimed = await claimLaunchedWork({ ...extensionEnvironment, proofReader, guard, notify, signal: shutdown.signal });
                if (shutdown.signal.aborted) {
                    await claimed.shutdown();
                    return;
                }
                session = claimed;
            } catch (error) {
                guard.markLost();
                if (context.hasUI) context.ui.notify(describeRefusal(error), 'error');
                return;
            }
            registerFinish(session);
        };

        const registerFinish = (claimed: ClaimedSession): void => {
            pi.registerTool({
                name: FinishTool,
                label: 'Finish Direct work',
                description: 'Release the Direct work this session claimed, with an outcome. Call it once, when you are done.',
                parameters: Type.Object({
                    outcome: Type.Union([Type.Literal('Delivered'), Type.Literal('Abandoned'), Type.Literal('Blocked'), Type.Literal('Declined')]),
                    reason: Type.Optional(Type.String())
                }),
                executionMode: 'sequential',
                async execute(_toolCallId, parameters) {
                    await claimed.finish(parameters.outcome as ReleaseOutcome, parameters.reason);
                    return { content: [{ type: 'text', text: `Released as ${parameters.outcome}.` }], details: {} };
                }
            });
        };

        pi.on('session_start', async (_event, context) => {
            if (!isLaunchedSession(extensionEnvironment.env)) return;
            guard.markPending();
            await start(context);
        });
        pi.on('before_agent_start', () => {
            if (!session || announced) return undefined;
            if (shutdown.signal.aborted) return undefined;
            announced = true;
            return { message: { customType: workMessageType, content: describeWork(session.payload), display: true } };
        });
        pi.on('tool_call', event => {
            session?.checkLease();
            return guard.blocks(event.toolName)
                ? { block: true, reason: 'Claim authority for this Direct work is not live; this session can no longer write.' }
                : undefined;
        });
        pi.on('session_shutdown', async () => {
            shutdown.abort();
            if (isLaunchedSession(extensionEnvironment.env)) guard.markLost();
            await session?.shutdown();
        });
        pi.registerCommand('direct-link', {
            description: 'Direct local sessions: login --tenant <id> | status',
            handler: async (args, context) => { context.ui.notify(await runDirectLink(args, link), 'info'); }
        });
    };
}

export default function (pi: ExtensionAPI): void {
    createExtension({
        env: process.env,
        platform: process.platform,
        uid: process.getuid?.() ?? -1,
        runner: spawnRunner,
        clock: systemClock,
        connect: (url, tenant, token) => connectDirect(url, tenant, token)
    })(pi);
}

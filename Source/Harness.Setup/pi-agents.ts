// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { existsSync, lstatSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { isKnownToolName, normalizeToolsDetailed } from '../../.cratis/ai/harnesses/pi/extensions/subagent/tool-names.ts';
import { readCanonicalAgents, refusePinnedModel, type CanonicalAgent, type GeneratedAgent } from './opencode-agents.ts';

export const piAgentsDirectory = 'harnesses/pi/agents';
export const piAgentMarkerPrefix = '<!-- cratis-ai: generated Pi adapter of agents/';

/**
 * Pi-native allowlists work in both the Cratis loader and external Agent loaders without normalization.
 * The frontmatter is copied, so `modelTier` and `reviewIndependence` travel with the agent; a native `model:`
 * is refused, because Pi passes it verbatim to `--model` and the tier is bound by the consumer instead.
 */
export function generatePiAgent(agent: CanonicalAgent): GeneratedAgent {
    refusePinnedModel(agent);
    const unresolved = agent.tools.filter(tool => !isKnownToolName(tool));
    if (unresolved.length > 0) throw new Error(`${agent.file} declares unresolved Pi tools: ${unresolved.join(', ')}.`);
    const { tools } = normalizeToolsDetailed(agent.tools);
    // An empty allowlist can mean "inherit all tools" to a loader. Never widen a restricted agent that way.
    if (!tools?.length) throw new Error(`${agent.file} declares no Pi-resolvable tools.`);
    const frontmatter = [...agent.frontmatter];
    const index = frontmatter.findIndex(line => line.startsWith('tools:'));
    if (index < 0) throw new Error(`${agent.file} declares no tools field.`);
    let end = index + 1;
    while (end < frontmatter.length && frontmatter[end].startsWith('  - ')) end++;
    frontmatter.splice(index, end - index, `tools: ${tools.join(', ')}`);
    return {
        source: agent.file,
        path: `${piAgentsDirectory}/${basename(agent.file)}`,
        content: `---\n${frontmatter.join('\n')}\n---\n${piAgentMarkerPrefix}${agent.file}. Do not edit; the canonical agent is the source. -->\n${agent.body}`,
    };
}

export function generatePiAgents(corpusRoot: string): GeneratedAgent[] {
    return readCanonicalAgents(corpusRoot).map(generatePiAgent);
}

/** Missing, stale and orphaned adapters all fail the drift gate, including occupied symlinks. */
export function checkPiAgents(corpusRoot: string): string[] {
    const expected = generatePiAgents(corpusRoot);
    const directory = join(corpusRoot, piAgentsDirectory);
    const failures: string[] = [];
    if (existsSync(directory) && (!lstatSync(directory).isDirectory() || lstatSync(directory).isSymbolicLink())) {
        return [`${piAgentsDirectory} is not a generated adapter directory.`];
    }
    for (const file of expected) {
        const path = join(corpusRoot, file.path);
        if (!existsSync(path)) failures.push(`${file.path} is missing (generated from agents/${file.source}).`);
        else if (!lstatSync(path).isFile() || readFileSync(path, 'utf8') !== file.content) failures.push(`${file.path} is stale (regenerate from agents/${file.source}).`);
    }
    const names = new Set(expected.map(file => basename(file.path)));
    if (existsSync(directory)) {
        for (const name of readdirSync(directory)) {
            if (!names.has(name)) failures.push(`${piAgentsDirectory}/${name} has no canonical agent (orphan).`);
        }
    }
    return failures;
}

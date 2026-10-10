// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Contract } from './Contract.ts';
import type { Exception } from './Exception.ts';
import { extract } from './extract.ts';
import { Kind } from './Kind.ts';
import type { Subject } from './Subject.ts';

export function parseContract(value: unknown): Contract {
    const object = (item: unknown): item is Record<string, unknown> => typeof item === 'object' && item !== null && !Array.isArray(item);
    const strings = (item: unknown): item is string[] => Array.isArray(item) && item.every(entry => typeof entry === 'string');
    const unique = (values: string[]) => new Set(values).size === values.length;
    if (!object(value) || value.schemaVersion !== 1) throw new Error('Unsupported Screenplay contract schemaVersion (expected 1).');
    for (const key of ['keywords', 'topLevelConstructs']) {
        if (!strings(value[key]) || value[key].length === 0 || !unique(value[key])) throw new Error(`Invalid contract ${key}.`);
    }
    for (const key of ['constructs', 'diagnostics', 'mcpTools', 'cliCommands']) {
        const entries = value[key];
        if (!Array.isArray(entries) || entries.length === 0 || !entries.every(object)) throw new Error(`Invalid contract ${key}.`);
        const identity = key === 'diagnostics' ? 'code' : 'name';
        if (!entries.every(entry => typeof entry[identity] === 'string') || !unique(entries.map(entry => entry[identity] as string))) throw new Error(`Invalid or duplicate contract ${key} identities.`);
        if (key === 'diagnostics' && !entries.every(entry => /^PLAY\d{4}$/.test(entry.code as string) && typeof entry.reserved === 'boolean' && typeof entry.retired === 'boolean')) throw new Error('Invalid contract diagnostics.');
        if (key === 'mcpTools' && !entries.every(entry => strings(entry.requiredParameters) && strings(entry.optionalParameters))) throw new Error('Invalid contract MCP parameters.');
        if (key === 'cliCommands' && !entries.every(entry => strings(entry.options) && strings(entry.aliases))) throw new Error('Invalid contract CLI options.');
    }
    return value as unknown as Contract;
}

export function parseExceptions(value: unknown): Exception[] {
    if (!Array.isArray(value) || !value.every(entry => typeof entry === 'object' && entry !== null &&
        ['file', 'text', 'value', 'reason'].every(key => typeof entry[key] === 'string' && entry[key].trim().length > 0) && Object.values(Kind).includes(entry.kind))) {
        throw new Error('Every contract exception needs file, exact text, kind, value and a nonempty reason.');
    }
    const exceptions = value as Exception[];
    if (new Set(exceptions.map(entry => JSON.stringify([entry.file, entry.text, entry.kind, entry.value]))).size !== exceptions.length) throw new Error('Duplicate contract exceptions.');
    return exceptions;
}

function defect(subject: Subject, contract: Contract): string | undefined {
    switch (subject.kind) {
        case Kind.Diagnostic: {
            const diagnostic = contract.diagnostics.find(item => item.code === subject.value);
            return !diagnostic ? `unknown diagnostic ${subject.value}` : diagnostic.retired ? `retired diagnostic ${subject.value}` : undefined;
        }
        case Kind.McpTool:
            return contract.mcpTools.some(item => item.name === subject.value) ? undefined : `unknown MCP tool ${subject.value}`;
        case Kind.McpParameter: {
            const tool = contract.mcpTools.find(item => item.name === subject.owner);
            return tool && [...tool.requiredParameters, ...tool.optionalParameters].includes(subject.value) ? undefined : `unknown MCP parameter ${subject.owner}.${subject.value}`;
        }
        case Kind.ToolCount: {
            const count = Number(subject.value);
            // The corpus explicitly distinguishes the MCP-Apps visualization tool from the base catalog.
            const visualizationSplit = /\b(\d+) tools without visualization, (\d+) with it\b/.exec(subject.text);
            if (visualizationSplit && contract.mcpTools.some(tool => tool.name === 'visualize-model') && Number(visualizationSplit[1]) + 1 === contract.mcpTools.length && Number(visualizationSplit[2]) === contract.mcpTools.length) return undefined;
            return count === contract.mcpTools.length ? undefined : `MCP tool count ${count}, contract has ${contract.mcpTools.length}`;
        }
        case Kind.CliCommand:
            return contract.cliCommands.some(item => item.name === subject.value || item.aliases.includes(subject.value)) ? undefined : `unknown screenplay CLI command ${subject.value}`;
        case Kind.CliOption: {
            const globalAliases = contract.cliCommands.flatMap(item => item.aliases);
            const command = contract.cliCommands.find(item => item.name === (subject.owner === 'validate' ? '' : subject.owner));
            return globalAliases.includes(subject.value) || command?.options.includes(subject.value) ? undefined : `unknown screenplay ${subject.owner} option ${subject.value}`;
        }
    }
}

export function pinProblems(pin: string, version: string): string[] {
    return pin === version ? [] : [`.cratis/ai/skills/cratis-screenplay-toolchain/references/screenplay-contract.version:1 contract version ${version} differs from standalone pin ${pin}.`];
}

export function coverage(contract: Contract, documents: Array<{ file: string; content: string }>, subjects: Subject[]) {
    const text = documents.map(document => document.content).join('\n');
    const mentioned = (word: string) => new RegExp(`(?<![\\w-])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`).test(text);
    const codes = new Set(subjects.filter(subject => subject.kind === Kind.Diagnostic).map(subject => subject.value));
    const tools = new Set(subjects.filter(subject => subject.kind === Kind.McpTool).map(subject => subject.value));
    const active = contract.diagnostics.filter(diagnostic => !diagnostic.reserved && !diagnostic.retired);
    const families = [...new Set(active.map(diagnostic => `${diagnostic.code.slice(0, 6)}xx`))];
    return {
        keywords: contract.keywords.filter(word => !mentioned(word)),
        constructs: [...new Set([...contract.topLevelConstructs, ...contract.constructs.map(construct => construct.name)])].filter(word => !mentioned(word)),
        mcpTools: contract.mcpTools.map(tool => tool.name).filter(name => !tools.has(name)),
        diagnosticCodes: active.map(diagnostic => diagnostic.code).filter(code => !codes.has(code)),
        diagnosticFamilies: families.filter(family => !active.some(diagnostic => diagnostic.code.startsWith(family.slice(0, 6)) && codes.has(diagnostic.code))),
    };
}

export function check(contract: Contract, documents: Array<{ file: string; content: string }>, exceptions: Exception[] = [], requireExceptions = true, vocabulary = contract) {
    // Retain pinned names during release comparison so a removed tool is still a subject.
    const extractionContract = { ...contract, mcpTools: [...contract.mcpTools, ...vocabulary.mcpTools] };
    const subjects = documents.flatMap(document => extract(document.file, document.content, extractionContract));
    const counts = Object.fromEntries(Object.values(Kind).map(kind => [kind, subjects.filter(subject => subject.kind === kind).length]));
    const problems: string[] = [];
    const used = new Set<Exception>();
    const exempted: Subject[] = [];
    for (const subject of subjects) {
        const problem = defect(subject, contract);
        if (!problem) continue;
        const exception = exceptions.find(entry => entry.file === subject.file && entry.text === subject.text && entry.kind === subject.kind && entry.value === subject.value);
        if (exception) {
            used.add(exception);
            exempted.push(subject);
        } else problems.push(`${subject.file}:${subject.line} ${problem}.`);
    }
    if (requireExceptions) for (const exception of exceptions) {
        if (!used.has(exception)) problems.push(`${exception.file}:1 unnecessary contract exception for ${exception.kind} ${exception.value}; remove it or re-check its exact text.`);
    }
    for (const [kind, count] of Object.entries(counts)) if (count === 0) problems.push(`Screenplay contract: checked zero ${kind} subjects (matcher or corpus scope is empty).`);
    return { counts, problems, exempted, matchedTools: subjects.filter(subject => subject.kind === Kind.McpTool), coverage: coverage(contract, documents, subjects) };
}

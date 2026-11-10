// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import type { Contract } from './Contract.ts';
import type { Exception } from './Exception.ts';
import { extract } from './extract.ts';
import { Kind } from './Kind.ts';
import type { Subject } from './Subject.ts';

type Entry = Record<string, unknown>;

const isObject = (item: unknown): item is Entry => typeof item === 'object' && item !== null && !Array.isArray(item);
const isStrings = (item: unknown): item is string[] => Array.isArray(item) && item.every(entry => typeof entry === 'string');
const isUnique = (values: string[]) => new Set(values).size === values.length;

function requireTextList(value: Entry, key: string): void {
    const list = value[key];
    if (!isStrings(list) || list.length === 0 || !isUnique(list)) throw new Error(`Invalid contract ${key}.`);
}

/** Entry-specific checks that run after the shared identity checks, keyed by contract section. */
const entryChecks: Record<string, (entries: Entry[]) => void> = {
    constructs: () => undefined,
    diagnostics: entries => {
        if (!entries.every(entry => /^PLAY\d{4}$/.test(entry.code as string) && typeof entry.reserved === 'boolean' && typeof entry.retired === 'boolean')) throw new Error('Invalid contract diagnostics.');
    },
    mcpTools: entries => {
        if (!entries.every(entry => isStrings(entry.requiredParameters) && isStrings(entry.optionalParameters))) throw new Error('Invalid contract MCP parameters.');
    },
    cliCommands: entries => {
        if (!entries.every(entry => isStrings(entry.options) && isStrings(entry.aliases))) throw new Error('Invalid contract CLI options.');
    },
};

function requireEntries(value: Entry, key: string): void {
    const entries = value[key];
    if (!Array.isArray(entries) || entries.length === 0 || !entries.every(isObject)) throw new Error(`Invalid contract ${key}.`);
    const identity = key === 'diagnostics' ? 'code' : 'name';
    if (!entries.every(entry => typeof entry[identity] === 'string') || !isUnique(entries.map(entry => entry[identity] as string))) throw new Error(`Invalid or duplicate contract ${key} identities.`);
    entryChecks[key](entries);
}

export function parseContract(value: unknown): Contract {
    if (!isObject(value) || value.schemaVersion !== 1) throw new Error('Unsupported Screenplay contract schemaVersion (expected 1).');
    for (const key of ['keywords', 'topLevelConstructs']) requireTextList(value, key);
    for (const key of Object.keys(entryChecks)) requireEntries(value, key);
    return value as unknown as Contract;
}

function isValidException(entry: unknown): boolean {
    return isObject(entry) &&
        ['file', 'text', 'value', 'reason'].every(key => typeof entry[key] === 'string' && entry[key].trim().length > 0) &&
        Object.values(Kind).includes(entry.kind as Kind);
}

export function parseExceptions(value: unknown): Exception[] {
    if (!Array.isArray(value) || !value.every(isValidException)) {
        throw new Error('Every contract exception needs file, exact text, kind, value and a nonempty reason.');
    }
    const exceptions = value as Exception[];
    if (new Set(exceptions.map(entry => JSON.stringify([entry.file, entry.text, entry.kind, entry.value]))).size !== exceptions.length) throw new Error('Duplicate contract exceptions.');
    return exceptions;
}

function diagnosticDefect(subject: Subject, contract: Contract): string | undefined {
    const diagnostic = contract.diagnostics.find(item => item.code === subject.value);
    if (!diagnostic) return `unknown diagnostic ${subject.value}`;
    return diagnostic.retired ? `retired diagnostic ${subject.value}` : undefined;
}

function mcpParameterDefect(subject: Subject, contract: Contract): string | undefined {
    const tool = contract.mcpTools.find(item => item.name === subject.owner);
    return tool && [...tool.requiredParameters, ...tool.optionalParameters].includes(subject.value) ? undefined : `unknown MCP parameter ${subject.owner}.${subject.value}`;
}

/** The base-catalog count of a "N tools without visualization, M with it" split, or undefined when the split is invalid. */
function visualizationBaseCount(text: string, contract: Contract): number | undefined {
    const split = /\b(\d+) tools without visualization, (\d+) with it\b/.exec(text);
    const total = contract.mcpTools.length;
    const valid = split !== null && contract.mcpTools.some(tool => tool.name === 'visualize-model') && Number(split[1]) + 1 === total && Number(split[2]) === total;
    return valid ? Number(split[1]) : undefined;
}

function toolCountDefect(subject: Subject, contract: Contract): string | undefined {
    const count = Number(subject.value);
    // The corpus explicitly distinguishes the MCP-Apps visualization tool from the base catalog.
    if (/\btools\s+without\s+visualization\b/.test(subject.text)) {
        const baseCount = visualizationBaseCount(subject.text, contract);
        if (baseCount === undefined) return `invalid MCP visualization-count split; contract has ${contract.mcpTools.length} tools`;
        if (count === baseCount) return undefined;
    }
    return count === contract.mcpTools.length ? undefined : `MCP tool count ${count}, contract has ${contract.mcpTools.length}`;
}

function cliOptionDefect(subject: Subject, contract: Contract): string | undefined {
    const globalAliases = contract.cliCommands.flatMap(item => item.aliases);
    const command = contract.cliCommands.find(item => item.name === (subject.owner === 'validate' ? '' : subject.owner));
    return globalAliases.includes(subject.value) || command?.options.includes(subject.value) ? undefined : `unknown screenplay ${subject.owner} option ${subject.value}`;
}

function defect(subject: Subject, contract: Contract): string | undefined {
    switch (subject.kind) {
        case Kind.Diagnostic: return diagnosticDefect(subject, contract);
        case Kind.McpTool:
            return contract.mcpTools.some(item => item.name === subject.value) ? undefined : `unknown MCP tool ${subject.value}`;
        case Kind.McpParameter: return mcpParameterDefect(subject, contract);
        case Kind.ToolCount: return toolCountDefect(subject, contract);
        case Kind.CliCommand:
            return contract.cliCommands.some(item => item.name === subject.value || item.aliases.includes(subject.value)) ? undefined : `unknown screenplay CLI command ${subject.value}`;
        case Kind.CliOption: return cliOptionDefect(subject, contract);
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

/** Subjects that violate the contract, split into those an exception covers and the problems of those it does not. */
function classifyDefects(subjects: Subject[], contract: Contract, exceptions: Exception[]) {
    const used = new Set<Exception>();
    const exempted: Subject[] = [];
    const problems: string[] = [];
    for (const subject of subjects) {
        const problem = defect(subject, contract);
        if (!problem) continue;
        const exception = exceptions.find(entry => entry.file === subject.file && entry.text === subject.text && entry.kind === subject.kind && entry.value === subject.value);
        if (exception) {
            used.add(exception);
            exempted.push(subject);
        } else problems.push(`${subject.file}:${subject.line} ${problem}.`);
    }
    return { used, exempted, problems };
}

function unusedExceptionProblems(exceptions: Exception[], used: Set<Exception>): string[] {
    return exceptions.filter(exception => !used.has(exception))
        .map(exception => `${exception.file}:1 unnecessary contract exception for ${exception.kind} ${exception.value}; remove it or re-check its exact text.`);
}

function emptyKindProblems(counts: Record<string, number>): string[] {
    return Object.entries(counts).filter(([, count]) => count === 0)
        .map(([kind]) => `Screenplay contract: checked zero ${kind} subjects (matcher or corpus scope is empty).`);
}

export function check(contract: Contract, documents: Array<{ file: string; content: string }>, exceptions: Exception[] = [], requireExceptions = true, vocabulary = contract) {
    // Retain pinned names during release comparison so a removed tool is still a subject.
    const extractionContract = { ...contract, mcpTools: [...contract.mcpTools, ...vocabulary.mcpTools] };
    const problems: string[] = [];
    const subjects = documents.flatMap(document => extract(document.file, document.content, extractionContract, problems));
    const counts = Object.fromEntries(Object.values(Kind).map(kind => [kind, subjects.filter(subject => subject.kind === kind).length]));
    const classified = classifyDefects(subjects, contract, exceptions);
    const { exempted } = classified;
    problems.push(...classified.problems);
    if (requireExceptions) problems.push(...unusedExceptionProblems(exceptions, classified.used));
    problems.push(...emptyKindProblems(counts));
    return { counts, problems, exempted, matchedTools: subjects.filter(subject => subject.kind === Kind.McpTool), coverage: coverage(contract, documents, subjects) };
}

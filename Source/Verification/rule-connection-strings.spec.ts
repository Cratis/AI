// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { frontmatter } from '../../.cratis/ai/harnesses/pi/extensions/shared/frontmatter.ts';

const rules = resolve(import.meta.dirname, '../../.cratis/ai/rules');

const schemeUri = /(?<![\w+.-])(?!https?:)[a-z][a-z0-9+.-]*:\/\/\S/i;
const credentialString = /\b(?:Password|Pwd)\s*=/i;

export function connectionStringFindings(content: string): string[] {
    return content.split('\n').flatMap((line, index) =>
        schemeUri.test(line) || credentialString.test(line) ? [`line ${index + 1}: ${line.trim()}`] : []);
}

function widelyScoped(content: string): boolean {
    const fields = frontmatter(content);
    const scopes = [...(fields.get('applyTo') ?? []), ...(fields.get('paths') ?? [])]
        .flatMap(scope => scope.split(','))
        .map(scope => scope.trim().replace(/^"|"$/g, ''));
    if (scopes.length === 0) return true;
    return scopes.some(scope => scope === '**/*' || scope === '*' || /\*\.cs$/.test(scope));
}

function ruleFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry =>
        entry.isDirectory() ? ruleFiles(join(directory, entry.name)) : entry.name.endsWith('.md') ? [join(directory, entry.name)] : []);
}

test('the connection string detector flags URIs and credential strings but not web links', () => {
    assert.equal(connectionStringFindings('const string c = "mongodb://localhost:27017";').length, 1);
    assert.equal(connectionStringFindings('Server=db;Password=x;').length, 1);
    assert.equal(connectionStringFindings('postgres://u@h/db').length, 1);
    assert.equal(connectionStringFindings('See https://example.com and http://localhost:5000').length, 0);
});

test('rules that load while reading C# carry no connection URIs or credential strings', () => {
    const scanned = ruleFiles(rules).filter(file => widelyScoped(readFileSync(file, 'utf8')));
    assert.ok(scanned.length > 0, 'at least one widely scoped rule is scanned');
    const findings = scanned.flatMap(file => connectionStringFindings(readFileSync(file, 'utf8')).map(finding => `${file}: ${finding}`));
    assert.deepEqual(findings, []);
});

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const supportRoot = new URL('../../../Cratis.AI/Providers/HarnessSupport/', import.meta.url);
const strings = expression => [...expression.matchAll(/"([^"]+)"/g)].map(match => match[1]);
const method = (source, name) => {
    const expression = source.match(new RegExp(`public string ${name}\\([^)]*\\)\\s*=>\\s*([^;]+);`))?.[1];
    assert.ok(expression, `Missing ${name} dispatch expression`);
    return expression;
};

function variablesFor(source, harness) {
    const expression = method(source, 'ApiKeyVariableFor');
    const variables = strings(expression);
    if (expression.includes('harness == Harness.Pi')) return [variables[harness === 'Pi' ? 0 : 1]];
    if (harness === 'Pi' && expression.includes('IsOAuthToken')) {
        assert.ok(source.includes('!(harness == Harness.Pi && AnthropicCredential.IsOAuthToken(apiKey))'));
        return [variables[1]];
    }
    return variables;
}

function piCases(source) {
    const providers = strings(method(source, 'PiProviderIdFor'));
    const variables = variablesFor(source, 'Pi');
    assert.ok(providers.length > 0, 'A Pi-dispatchable class must provide a provider id');
    assert.ok(variables.length === 1 || variables.length === providers.length, 'Unrecognized dispatch branching');
    return providers.map((provider, index) => {
        const variable = variables.length === 1 ? variables[0] : variables[index];
        assert.ok(variable, `Missing credential variable for ${provider}`);
        // This record is deliberately seeded into Pi's auth.json, not inherited by the CLI.
        return [provider, 'pi', variable === 'DIRECT_PI_OAUTH_CREDENTIAL' ? '' : variable];
    });
}

const cases = [];
const claudeVariables = new Set();
for (const file of ['ProviderHarnessSupport.cs', 'CopilotHarnessSupport.cs']) {
    const source = readFileSync(new URL(file, supportRoot), 'utf8');
    const classes = source.split(/(?=public class \w+ : IHarnessSupport)/).slice(1);
    assert.ok(classes.length > 0, `No dispatch classes in ${file}`);
    for (const type of classes) {
        const harnesses = type.match(/SupportedHarnesses[^=]+=\s*new HashSet<Harness>\s*\{([^}]+)\}/)?.[1];
        assert.ok(harnesses, 'Missing supported harnesses');
        if (harnesses.includes('Harness.Pi')) cases.push(...piCases(type));
        if (harnesses.includes('Harness.Claude')) {
            for (const variable of variablesFor(type, 'Claude')) claudeVariables.add(variable);
        }
        if (harnesses.includes('Harness.Copilot')) {
            assert.ok(method(type, 'PiProviderIdFor').trim() === 'string.Empty', 'Copilot must not dispatch Pi');
            cases.push(['copilot', 'copilot', variablesFor(type, 'Copilot').join(',')]);
        }
    }
}
assert.ok(claudeVariables.size > 0);
cases.push(['claude-code', 'claude', [...claudeVariables].join(',')]);
for (const row of new Set(cases.map(item => item.join('|')))) process.stdout.write(`${row}\n`);

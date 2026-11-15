// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const root = resolve(import.meta.dirname, '../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

// Pinned product contract (read at the named commits; update with the recorded CLI baseline):
//   Cratis/cli 81219e0b8720ceff7ec6bb592d47ce154da0c705 Source/Cli/Commands/Run/RunSettings.cs:
//     `cratis run` has `--engine <ENGINE>`; semantic is the default, eventmodel the explicit fallback.
//   Cratis/Stage 1bd51950d4979f76e07c933845a96e8c7a3cd2af Source/Host/StageRuntimeEngine.cs: the engine defaults to semantic.
const evaluations = ['cratis-stage-rendering-and-sandbox', 'cratis-screenplay-render-and-gap-fill']
    .map(skill => ({ skill, text: read(`Evaluations/skills/${skill}/evals.json`) }));
const reference = read('.cratis/ai/skills/cratis-stage-rendering-and-sandbox/references/sandbox-and-specrunner.md');

test('no evaluation oracle claims cratis run lacks an engine option or enforces no authorization by default', () => {
    for (const { skill, text } of evaluations) {
        assert.doesNotMatch(text, /no engine option/i, `${skill} contradicts the pinned --engine option`);
        assert.doesNotMatch(text, /default engine enforces no authorization/i, `${skill} attributes the legacy limit to the default`);
    }
});

test('the sandbox evaluation covers the current default, explicit semantic and explicit legacy engines', () => {
    const text = evaluations[0].text;
    assert.match(text, /plain `cratis run`/);
    assert.match(text, /--engine semantic/);
    assert.match(text, /--engine eventmodel/);
});

test('the sandbox reference does not call EventModel a default and names semantic as the default', () => {
    assert.doesNotMatch(reference, /EventModel \(legacy; the image's default\)/);
    assert.match(reference, /Semantic \(the default of `cratis run` and of Stage\)/);
});

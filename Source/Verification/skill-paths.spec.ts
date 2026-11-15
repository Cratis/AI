// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { allowedSkillKeys, skillFrontmatterProblems } from './skill-paths.ts';

const skill = (text: string) => `---\n${text}\n---\nBody\n`;

describe('skill frontmatter validation', () => {
    it('should leave missing and empty frontmatter to the caller', () => {
        for (const content of ['Body', skill(''), skill('null')]) {
            assert.deepEqual(skillFrontmatterProblems('demo', content), []);
        }
    });

    it('should reject scalar and sequence frontmatter with the same message', () => {
        for (const text of ['plain text', '- name: demo', '123']) {
            assert.deepEqual(skillFrontmatterProblems('demo', skill(text)), ['demo has frontmatter that is not a YAML map of keys and values.']);
        }
    });

    it('should retain key, metadata shape and hint validation order', () => {
        assert.deepEqual(allowedSkillKeys, ['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools']);
        assert.deepEqual(skillFrontmatterProblems('demo', skill('extra: value\npaths: example\nmetadata:\n  other: 123\n  1: value\n  cratis-hint-paths: ""')), [
            'demo declares top-level frontmatter key \'extra\', which Agent Skills does not allow (allowed: name, description, license, compatibility, metadata, allowed-tools); put vendor-specific values under \'metadata\'.',
            "demo declares 'paths', which Claude Code treats as conditional activation; use 'metadata.cratis-hint-paths' for path hints.",
            'demo declares \'metadata.other\' as a number; metadata.other must be a string (Agent Skills metadata maps strings to strings).',
            "demo declares the metadata key '1', which is not a string; metadata keys must be strings (Agent Skills metadata maps strings to strings), so quote it.",
            'demo declares \'metadata.cratis-hint-paths\' without any glob; it must be a non-empty string of whitespace-separated globs: cratis-hint-paths: "<glob> <glob>".',
        ]);
    });

    it('should report unresolved aliases as YAML errors rather than throwing', () => {
        assert.deepEqual(skillFrontmatterProblems('demo', skill('metadata: *missing')), [
            'demo has frontmatter that is not valid YAML: Unresolved alias (the anchor must be set before the alias): missing',
        ]);
    });
});

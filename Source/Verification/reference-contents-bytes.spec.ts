// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { referenceContentsProblems, skillStructureProblems, withReferenceContents } from './skill-structure.ts';

describe('reference Contents byte preservation', () => {
    it('should repair duplicate misplaced lists without changing CRLF prose or a missing final newline', () => {
        const original = '# Reference\r\n\r\nIntroductory prose.\r\n\r\n## First\r\nFirst prose.\r\n\r\n## Second\r\n' + 'More prose.\r\n'.repeat(105) + 'Final prose.';
        const misplaced = original.replace('## First', '## Contents\r\n\r\n- Wrong\r\n\r\n## First').replace('## Second', '## Contents\r\n\r\n- Duplicate\r\n\r\n## Second');
        const expected = original.replace('# Reference\r\n\r\n', '# Reference\r\n\r\n## Contents\r\n\r\n- First\r\n- Second\r\n\r\n');
        assert.equal(withReferenceContents(misplaced), expected);
        assert.equal(withReferenceContents(expected), expected);
        assert.deepEqual(referenceContentsProblems('reference.md', expected), []);
    });

    it('should retain the missing-heading error before checking an existing Contents section', () => {
        const content = '# Reference\n\n## Contents\n\n- Old\n\n' + 'Prose.\n'.repeat(105);
        assert.deepEqual(referenceContentsProblems('reference.md', content), [
            'reference.md is a long reference with no H2/H3 headings outside fences and is not a single example listing; add headings so a Contents list can be generated.',
        ]);
        assert.equal(withReferenceContents(content), content);
    });
});

describe('skill structure malformed frontmatter', () => {
    it('should leave unresolved aliases and non-mapping YAML to the frontmatter validator', () => {
        for (const fields of ['name: *missing', '- item', 'null', 'plain text']) {
            assert.deepEqual(skillStructureProblems('demo', `---\n${fields}\n---\nBody\n`), []);
        }
    });
});

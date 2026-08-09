// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { sortIssues } from '../issueOrdering';

interface TestIssue {
    name: string;
    createdAt: number;
    order?: number;
}

describe('when sorting issues', () => {
    const issues: TestIssue[] = [
        { name: 'oldest', createdAt: 1 },
        { name: 'newest', createdAt: 3 },
        { name: 'dragged-first', createdAt: 2, order: 0 },
    ];

    const sorted = sortIssues(issues, (issue) => issue.createdAt);

    it('should put the manually ordered issue first', () => {
        sorted[0].name.should.equal('dragged-first');
    });

    it('should put the newest undragged issue next', () => {
        sorted[1].name.should.equal('newest');
    });

    it('should put the oldest undragged issue last', () => {
        sorted[2].name.should.equal('oldest');
    });
});

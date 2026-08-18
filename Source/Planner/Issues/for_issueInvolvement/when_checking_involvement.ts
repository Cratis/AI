// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { isInvolvedInIssue } from '../issueInvolvement';

describe('when checking involvement', () => {
    it('should find a login mentioned in the issue body', () => {
        isInvolvedInIssue('octocat', { body: 'cc @octocat please take a look' }).should.be.true;
    });

    it('should find a login mentioned in a comment body', () => {
        isInvolvedInIssue('octocat', { comments: [{ body: 'cc @octocat, thoughts?' }] }).should.be.true;
    });

    it('should find the author of a comment', () => {
        isInvolvedInIssue('octocat', { comments: [{ author: 'octocat', body: 'looks good to me' }] }).should.be.true;
    });

    it('should find the creator of the issue', () => {
        isInvolvedInIssue('octocat', { createdBy: 'octocat' }).should.be.true;
    });

    it('should not find a login that is not involved', () => {
        isInvolvedInIssue('octocat', {
            createdBy: 'realuser',
            body: 'no mentions here',
            comments: [{ author: 'anotheruser', body: 'still nothing' }],
        }).should.be.false;
    });

    it('should not match a mention inside a fenced code block', () => {
        isInvolvedInIssue('octocat', { body: '```\nmentioning @octocat here does not count\n```' }).should.be.false;
    });

    it('should not match a mention inside inline code', () => {
        isInvolvedInIssue('octocat', { body: 'use `@octocat` as a placeholder, nothing else here' }).should.be.false;
    });

    it('should not match an email address', () => {
        isInvolvedInIssue('bar', { body: 'contact foo@bar.com for details' }).should.be.false;
    });

    it('should find a hyphenated login', () => {
        isInvolvedInIssue('octo-cat', { body: 'assigned to @octo-cat' }).should.be.true;
    });

    it('should match case-insensitively', () => {
        isInvolvedInIssue('OctoCat', { body: '@octocat replied' }).should.be.true;
    });
});

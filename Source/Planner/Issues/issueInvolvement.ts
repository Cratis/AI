// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * The parts of an issue comment needed to determine mention-based involvement - a comment's author
 * and its markdown body. A subset of the generated `IssueComment` read model, kept independent of
 * the proxy so this module has no generated-code dependency.
 */
export interface InvolvableComment {
    author?: string;
    body?: string;
}

/**
 * The parts of an issue needed to determine involvement - who created it, who it is assigned to,
 * its markdown body, and the same shape for each of its comments. A subset of the generated
 * `Issue` read model, kept independent of the proxy for the same reason as
 * {@link InvolvableComment}.
 */
export interface InvolvableIssue {
    createdBy?: string;
    assignees?: string[];
    body?: string;
    comments?: InvolvableComment[];
}

const fencedCodeBlockExpression = /```[\s\S]*?```/g;
const inlineCodeExpression = /`[^`\r\n]*`/g;
const mentionExpression = /(?<![\w@])@([A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?)(?!\w)/g;

/**
 * Finds every GitHub login mentioned in a body of markdown text. A mention is `@` followed by 1-39
 * alphanumeric-or-hyphen characters that neither start nor end with a hyphen - GitHub's own login
 * format. Mentions inside fenced code blocks or inline code are ignored, as is any `@` that is part
 * of a longer word - which is what keeps this from matching the local part of an email address.
 * @param body The markdown text to search. An absent body yields no mentions.
 * @returns The mentioned logins, in the casing they were written with, not de-duplicated.
 */
const mentionsIn = (body: string | undefined): string[] => {
    if (!body) return [];

    const withoutCode = body
        .replace(fencedCodeBlockExpression, '')
        .replace(inlineCodeExpression, '');

    return [...withoutCode.matchAll(mentionExpression)].map((match) => match[1]);
};

/**
 * Determines whether a GitHub login is involved in an issue.
 *
 * "Involved" covers every place the issue names the login: assigned to it, mentioned in the issue
 * body, mentioned in a comment body, the author of a comment, or the creator of the issue.
 * @param login The GitHub login to check for involvement. Comparison is case-insensitive.
 * @param issue The issue to check.
 * @returns True if the login is involved in the issue.
 */
export const isInvolvedInIssue = (login: string, issue: InvolvableIssue): boolean => {
    const normalizedLogin = login.trim().toLowerCase();
    if (!normalizedLogin) return false;

    if (issue.createdBy?.toLowerCase() === normalizedLogin) return true;
    if ((issue.assignees ?? []).some((assignee) => assignee.toLowerCase() === normalizedLogin)) return true;
    if (mentionsIn(issue.body).some((mention) => mention.toLowerCase() === normalizedLogin)) return true;

    return (issue.comments ?? []).some((comment) =>
        comment.author?.toLowerCase() === normalizedLogin ||
        mentionsIn(comment.body).some((mention) => mention.toLowerCase() === normalizedLogin));
};

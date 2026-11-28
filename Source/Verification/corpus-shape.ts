// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { frontmatterFields } from './skill-structure.ts';
import type { InstalledFiles } from './installed-links.ts';

// Cross-SDK tasks from the parity inventory.
export const sharedSkills = [
    ...'select-backend-sdk host-application declare-command invoke-command declare-operation validate-command expose-query page-query diagnose-live-query connect-storage authorize-request isolate-tenant generate-proxies'.split(' ').map(task => `cratis-arc-${task}`),
    ...'select-client connect-application record-event constrain-append protect-decision project-view reduce-state react-to-fact evolve-event protect-personal-data publish-contract inspect-observer'.split(' ').map(task => `cratis-chronicle-${task}`),
    'cratis-fundamentals-name-value', 'cratis-specifications-exercise-backend',
];

export function packageProblems(files: InstalledFiles, retired: ReadonlySet<string>): string[] {
    const descriptions = new Map<string, string>();
    const problems = [...files.keys()].filter(path => retired.has(path.split('/')[1])).map(path => `Retired asset '${path}'.`);
    for (const [path, content] of files) {
        const skill = /^skills\/([^/]+)\//.exec(path)?.[1];
        if (!skill) continue;
        if (path !== `skills/${skill}/SKILL.md`) continue;
        const raw = frontmatterFields({ content })?.description;
        if (typeof raw !== 'string') continue;
        const description = raw.replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase();
        if (!description) continue;
        const previous = descriptions.get(description);
        if (previous) problems.push(`Skills '${previous}' and '${skill}' have duplicate invocation descriptions.`);
        else descriptions.set(description, skill);
    }
    return problems;
}

export const retiredSkills = new Set(`
application-react-specifications application-slice-conformance application-slice-specifications arc-authentication-authorization-and-identity
arc-command arc-command-execution arc-command-kotlin arc-command-operation
arc-command-typescript arc-command-validation arc-configuration arc-ef-core-migration
arc-elixir arc-go arc-hosting arc-mcp
arc-neo4j arc-observable-query-http arc-query-kotlin arc-query-paging
arc-query-typescript arc-react-page chronicle-client-dotnet chronicle-client-elixir
chronicle-client-go chronicle-client-kotlin chronicle-client-typescript chronicle-compliance
chronicle-configuration chronicle-decision-reads chronicle-event-constraints chronicle-event-modeling
chronicle-event-specifications chronicle-event-type-migration chronicle-hosting chronicle-multi-tenancy
chronicle-projection chronicle-reactor chronicle-read-model chronicle-read-model-specifications
chronicle-reducer components-common-controls components-data-surfaces components-schema-editor
components-stepper-command-dialog components-styling components-toolbar fundamentals-concept
multi-service-architecture screenplay-automations-and-translations screenplay-captures-and-reactions screenplay-command-surface
screenplay-delivery-planning screenplay-discovery screenplay-event-modeling screenplay-extension-packages
screenplay-legacy-extraction screenplay-model-authoring screenplay-model-review screenplay-modeling-lifecycle
screenplay-projections screenplay-read-surface screenplay-render-and-gap-fill screenplay-reverse-engineering
screenplay-scenario-coverage screenplay-slice-design screenplay-specifications screenplay-toolchain
screenplay-ui-composition specification-by-example specifications-csharp specifications-typescript
stage-rendering-and-sandbox
`.trim().split(/\s+/).map(name => `cratis-${name}`));

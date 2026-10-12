// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

export interface Product {
    id: string;
    name: string;
    repository: string;
    packages: Array<{ ecosystem: 'nuget' | 'npm' | 'maven' | 'hex' | 'go' | 'docker' | 'tool'; id: string }>;
    synced: { version: string; date: string; by: string } | null;
    covers: { skills: string[]; rules: string[] };
    notes?: string;
}
export interface ProductLedger { schemaVersion: '1.0.0'; products: Product[] }
export interface ProductSources { skills: string[]; rules: string[]; verifiedSkills: string[] }
export interface ProductSyncReport { problems: string[]; products: number; skills: number; rules: number; verifiedSkills: number }

const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every(text);
const kebab = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const productVersion = /^(?:(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*)?(?:\+[\da-zA-Z-]+(?:\.[\da-zA-Z-]+)*)?|main@[a-f0-9]{7})$/;

function fields(value: Record<string, unknown>, required: string[], optional: string[] = []): boolean {
    return required.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => [...required, ...optional].includes(key));
}
function realDate(value: unknown, today: string): boolean {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && value <= today;
}

/** Validate untrusted JSON before treating it as a ledger; references are checked against the actual corpus. */
export function productSyncProblems(document: unknown, sources: ProductSources, today = new Date().toISOString().slice(0, 10)): ProductSyncReport {
    const problems: string[] = [];
    const skills = new Set<string>();
    const rules = new Set<string>();
    const report = () => ({ problems, products: object(document) && Array.isArray(document.products) ? document.products.length : 0, skills: skills.size, rules: rules.size, verifiedSkills: sources.verifiedSkills.length });
    if (!object(document) || !fields(document, ['schemaVersion', 'products']) || document.schemaVersion !== '1.0.0' || !Array.isArray(document.products)) {
        problems.push('product-sync.json must contain schemaVersion 1.0.0 and a products array.');
        return report();
    }
    if (document.products.length === 0) problems.push('product-sync.json has zero products; the check would pass vacuously.');
    const ids = new Set<string>();
    const repositories = new Set<string>();
    for (const [index, product] of document.products.entries()) {
        const subject = `product-sync.json products[${index}]`;
        if (!object(product) || !fields(product, ['id', 'name', 'repository', 'packages', 'synced', 'covers'], ['notes'])) {
            problems.push(`${subject} has an invalid product shape.`);
            continue;
        }
        if (!text(product.id) || !kebab.test(product.id)) problems.push(`${subject} needs a kebab-case id.`);
        else if (ids.has(product.id)) problems.push(`${subject} duplicates id '${product.id}'.`);
        else ids.add(product.id);
        if (!text(product.name) || (product.notes !== undefined && !text(product.notes))) problems.push(`${subject} has an invalid name or notes.`);
        if (!text(product.repository) || !/^Cratis\/[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(product.repository)) problems.push(`${subject} needs a Cratis repository.`);
        else if (repositories.has(product.repository.toLowerCase())) problems.push(`${subject} duplicates repository '${product.repository}'.`);
        else repositories.add(product.repository.toLowerCase());
        if (!Array.isArray(product.packages) || !product.packages.every(item => object(item) && fields(item, ['ecosystem', 'id']) && ['nuget', 'npm', 'maven', 'hex', 'go', 'docker', 'tool'].includes(String(item.ecosystem)) && text(item.id))) problems.push(`${subject} has invalid packages.`);
        if (product.synced !== null) {
            if (!object(product.synced) || !fields(product.synced, ['version', 'date', 'by'])) problems.push(`${subject} has an invalid synced shape.`);
            else {
                if (!text(product.synced.version) || !productVersion.test(product.synced.version)) problems.push(`${subject} has an invalid synced version.`);
                if (!realDate(product.synced.date, today)) problems.push(`${subject} needs a real, non-future synced date.`);
                if (!text(product.synced.by) || !/^Cratis\/[A-Za-z0-9_.-]+#\d+$/.test(product.synced.by)) problems.push(`${subject} needs a synced issue/PR reference.`);
            }
        }
        if (!object(product.covers) || !fields(product.covers, ['skills', 'rules']) || !strings(product.covers.skills) || !strings(product.covers.rules)) {
            problems.push(`${subject} has invalid covers.`);
            continue;
        }
        for (const skill of product.covers.skills) {
            skills.add(skill);
            if (!kebab.test(skill) || !sources.skills.includes(skill)) problems.push(`${subject} covers missing skill '${skill}'.`);
        }
        for (const rule of product.covers.rules) {
            rules.add(rule);
            if (!/^[a-z0-9][a-z0-9.-]*\.md$/.test(rule) || !sources.rules.includes(rule)) problems.push(`${subject} covers missing rule '${rule}'.`);
        }
    }
    for (const skill of sources.verifiedSkills) if (!skills.has(skill)) problems.push(`Verified product sources skill '${skill}' is not covered by any product.`);
    return report();
}

export async function loadProductSync(root: string): Promise<{ document: unknown; sources: ProductSources }> {
    const corpus = join(root, '.cratis/ai');
    const skills = (await readdir(join(corpus, 'skills'), { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name);
    const verifiedSkills: string[] = [];
    for (const skill of skills) {
        const content = await readFile(join(corpus, 'skills', skill, 'SKILL.md'), 'utf8');
        if (/^## Verified product sources\s*$/m.test(content)) verifiedSkills.push(skill);
    }
    const rules = (await readdir(join(corpus, 'rules'), { withFileTypes: true })).filter(entry => entry.isFile()).map(entry => entry.name);
    return { document: JSON.parse(await readFile(join(corpus, 'product-sync.json'), 'utf8')), sources: { skills, rules, verifiedSkills } };
}
export function productSyncSummary(report: ProductSyncReport): string {
    return `Product sync: ${report.products} products, ${report.skills} covered skills, ${report.rules} covered rules, ${report.verifiedSkills} verified-source skills, ${report.problems.length} problems.`;
}

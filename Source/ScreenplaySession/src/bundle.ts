// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { filesUnder, readContent, type Content } from './content.ts';
import { agentsMarkdown, pluginManifest, pluginName, sessionContext, systemPrompt } from './forms.ts';

/** Raised only when the bundle layout or bundle.json changes incompatibly; consumers refuse other values. */
export const schemaVersion = 1;
export const bundleName = pluginName;
export const archiveName = `${bundleName}.zip`;

/** Where each form starts, relative to the bundle root. Part of the schemaVersion 1 contract. */
export const forms = {
    'claude-code': { plugin: '.', systemPrompt: 'system-prompt.md' },
    'agents-md': { instructions: 'AGENTS.md' },
    context: { document: 'context.md' }
} as const;

export interface BundleFile { path: string; sha256: string; size: number }

export interface BundleManifest {
    schemaVersion: number;
    name: string;
    version: string;
    source: { repository: string; commit: string };
    screenplay: { verifiedWith: string };
    forms: typeof forms;
    skills: { name: string; description: string; path: string }[];
    files: BundleFile[];
}

export interface BundleOptions {
    output: string;
    version: string;
    commit: string;
    screenplayVersion: string;
    license: string;
    content?: Content;
}

const fixedTime = new Date('2000-01-01T00:00:00Z');

function sha256(data: Buffer | string): string {
    return createHash('sha256').update(data).digest('hex');
}

function write(root: string, path: string, data: string): void {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), data);
}

/** Writes the bundle directory and its bundle.json; returns the manifest. */
export function buildBundle(options: BundleOptions): BundleManifest {
    const content = options.content ?? readContent();
    const root = options.output;
    rmSync(root, { recursive: true, force: true });
    mkdirSync(root, { recursive: true });

    const readSkillFile = (skill: { name: string }, file: string) => readFileSync(join(content.root, 'skills', skill.name, file), 'utf8');
    for (const skill of content.skills) {
        for (const file of skill.files) write(root, `skills/${skill.name}/${file}`, readSkillFile(skill, file));
    }
    write(root, 'README.md', content.readme.replaceAll('{{version}}', options.version));
    write(root, forms['claude-code'].systemPrompt, systemPrompt(content));
    write(root, forms['agents-md'].instructions, agentsMarkdown(content));
    write(root, forms.context.document, sessionContext(content, readSkillFile));
    write(root, '.claude-plugin/plugin.json', pluginManifest(options.version));
    copyFileSync(options.license, join(root, 'LICENSE'));

    const files = filesUnder(root).map(path => {
        const data = readFileSync(join(root, path));
        return { path, sha256: sha256(data), size: data.length };
    });
    const manifest: BundleManifest = {
        schemaVersion,
        name: bundleName,
        version: options.version,
        source: { repository: 'https://github.com/Cratis/AI', commit: options.commit },
        screenplay: { verifiedWith: options.screenplayVersion },
        forms,
        skills: content.skills.map(skill => ({ name: skill.name, description: skill.description, path: `skills/${skill.name}/SKILL.md` })),
        files
    };
    write(root, 'bundle.json', `${JSON.stringify(manifest, undefined, 2)}\n`);
    return manifest;
}

/** Zips the bundle directory with its files at the archive root, in sorted order and with fixed times. */
export function archiveBundle(bundleDirectory: string, archive: string): string {
    const files = filesUnder(bundleDirectory);
    for (const file of files) utimesSync(join(bundleDirectory, file), fixedTime, fixedTime);
    rmSync(archive, { force: true });
    execFileSync('zip', ['-X', '-D', '-q', archive, '-@'], {
        cwd: bundleDirectory,
        input: `${files.join('\n')}\n`,
        env: { ...process.env, TZ: 'UTC' },
        stdio: ['pipe', 'inherit', 'inherit']
    });
    const checksum = sha256(readFileSync(archive));
    writeFileSync(`${archive}.sha256`, `${checksum}  ${archiveName}\n`);
    return checksum;
}

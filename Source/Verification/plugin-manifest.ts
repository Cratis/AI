// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** The plugin manifest's path, relative to the repository root. */
export const pluginManifestPath = '.cratis/ai/plugin.json';

// Semantic Versioning 2.0.0, as awesome-copilot's external-plugin intake checks it.
const semver = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

// The Copilot CLI (legacy) plugin.json fields; anything else is a typo or an invented field.
const copilotFields = ['name', 'description', 'version', 'author', 'homepage', 'repository', 'license', 'keywords', 'category', 'tags',
    'agents', 'skills', 'commands', 'hooks', 'extensions', 'mcpServers', 'lspServers'];

/**
 * Problems with the Copilot plugin manifest, including a version that differs from the plugin entry of any marketplace manifest.
 * The version is a manifest version: it changes with the plugin's shape, together with the marketplace manifests, not per release.
 */
export function pluginManifestProblems(manifest: unknown, marketplaces: Array<{ path: string; document: unknown }>): string[] {
    if (!object(manifest)) return [`${pluginManifestPath} must be a JSON object.`];
    const problems: string[] = [];
    const subject = pluginManifestPath;
    for (const key of Object.keys(manifest)) {
        if (!copilotFields.includes(key)) problems.push(`${subject} has field '${key}', which is not a Copilot CLI plugin.json field.`);
    }
    if (typeof manifest.name !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(manifest.name) || manifest.name.length > 64) {
        problems.push(`${subject} 'name' must be a lowercase hyphenated name of at most 64 characters.`);
    }
    if (!text(manifest.description) || manifest.description.length > 500) problems.push(`${subject} 'description' must be a non-empty string of at most 500 characters.`);
    const versioned = typeof manifest.version === 'string' && semver.test(manifest.version);
    if (!versioned) problems.push(`${subject} 'version' must be a semantic version such as 1.0.0; found '${String(manifest.version)}'.`);
    if (!object(manifest.author) || !text(manifest.author.name)) problems.push(`${subject} 'author.name' is required.`);
    else if (manifest.author.url !== undefined && !https(manifest.author.url)) problems.push(`${subject} 'author.url' must be an https URL.`);
    if (!https(manifest.homepage)) problems.push(`${subject} 'homepage' must be an https URL.`);
    if (!https(manifest.repository) || new URL(manifest.repository as string).hostname !== 'github.com') {
        problems.push(`${subject} 'repository' must be an https://github.com/ URL.`);
    }
    if (manifest.license !== 'MIT') problems.push(`${subject} 'license' must be 'MIT', the repository's license.`);
    if (!Array.isArray(manifest.keywords) || manifest.keywords.length === 0 || manifest.keywords.length > 10 ||
        manifest.keywords.some(keyword => typeof keyword !== 'string' || !/^[a-z0-9-]{1,30}$/.test(keyword))) {
        problems.push(`${subject} 'keywords' must hold 1-10 lowercase hyphenated keywords of at most 30 characters.`);
    }
    if (manifest.skills !== './skills') problems.push(`${subject} 'skills' must be './skills', the canonical skill tree.`);

    for (const { path, document } of marketplaces) {
        const entry = object(document) && Array.isArray(document.plugins) ? document.plugins[0] : undefined;
        if (!object(entry)) continue;
        if (entry.name !== manifest.name) problems.push(`${subject} name '${String(manifest.name)}' differs from ${path} plugin name '${String(entry.name)}'.`);
        if (entry.version !== undefined && entry.version !== manifest.version) {
            problems.push(`${subject} version '${String(manifest.version)}' differs from ${path} plugin version '${String(entry.version)}'; ` +
                'it is a manifest version, so bump it together with every marketplace manifest when the plugin changes shape.');
        }
    }
    return problems;
}

function object(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

function https(value: unknown): boolean {
    if (!text(value)) return false;
    try {
        return new URL(value).protocol === 'https:';
    } catch {
        return false;
    }
}

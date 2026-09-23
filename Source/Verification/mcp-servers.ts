// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Validate corpus-owned launch declarations without writing or executing client configuration. */
export function validateMcpServers(value: unknown, profileIds: ReadonlySet<string>): string[] {
    const failures: string[] = [];
    if (!object(value) || value.schemaVersion !== '1.0' || !Array.isArray(value.servers) || value.servers.length === 0) {
        return ['MCP catalogue requires schemaVersion 1.0 and at least one server.'];
    }
    for (const key of Object.keys(value)) {
        if (!['schemaVersion', 'servers'].includes(key)) failures.push(`Unknown MCP catalogue member '${key}'.`);
    }
    const ids = new Set<string>();
    for (const server of value.servers) {
        if (!object(server)) {
            failures.push('MCP server declaration must be an object.');
            continue;
        }
        const id = typeof server.id === 'string' ? server.id : '<missing>';
        if (!/^[a-z][a-z0-9-]*$/.test(id) || ids.has(id)) failures.push(`Invalid or duplicate MCP server id '${id}'.`);
        ids.add(id);
        for (const key of Object.keys(server)) {
            if (!['id', 'profiles', 'transport', 'command', 'args', 'defaultRoot', 'description'].includes(key)) {
                failures.push(`MCP server '${id}' has unknown member '${key}'.`);
            }
        }
        if (!Array.isArray(server.profiles) || server.profiles.length === 0 ||
            server.profiles.some((profile: unknown) => typeof profile !== 'string' || !profileIds.has(profile))) {
            failures.push(`MCP server '${id}' must select known profiles.`);
        }
        if (server.transport !== 'stdio') failures.push(`MCP server '${id}' must declare the supported stdio transport.`);
        if (typeof server.command !== 'string' || !server.command.trim()) failures.push(`MCP server '${id}' requires a command.`);
        if (!Array.isArray(server.args) || server.args.some((argument: unknown) => typeof argument !== 'string')) {
            failures.push(`MCP server '${id}' requires string arguments.`);
        }
        if (typeof server.defaultRoot !== 'string' || !server.defaultRoot ||
            server.defaultRoot.includes('\\') || server.defaultRoot.startsWith('/') || /^[a-z]:/i.test(server.defaultRoot) ||
            server.defaultRoot.split('/').some((part: string) => part === '..' || part.length === 0)) {
            failures.push(`MCP server '${id}' requires a portable project-relative default root.`);
        }
        if (typeof server.description !== 'string' || !server.description.trim()) failures.push(`MCP server '${id}' requires a description.`);
    }
    return failures;
}

function object(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

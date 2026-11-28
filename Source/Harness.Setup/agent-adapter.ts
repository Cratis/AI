/** Map explicit grants only. No shell, MCP wildcard, or inherited defaults. */
export function agentTools(tools: string[], harness: 'pi' | 'opencode'): string[] {
    const names: Record<string, string> = { Read: 'read', Grep: 'grep', Glob: harness === 'pi' ? 'find' : 'glob', Edit: 'edit', Write: harness === 'pi' ? 'write' : 'edit' };
    if (!tools.length || tools.some(tool => !Object.hasOwn(names, tool))) throw new Error('Unsupported agent tool grant');
    return [...new Set(tools.map(tool => names[tool]))];
}

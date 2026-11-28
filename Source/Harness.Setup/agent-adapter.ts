/** Map explicit grants only. No MCP wildcard, or inherited defaults. */
export function agentTools(file: string, tools: string[], harness: 'pi' | 'opencode'): string[] {
    const names: Record<string, string> = { Bash: 'bash', Read: 'read', Grep: 'grep', Glob: harness === 'pi' ? 'find' : 'glob', Edit: 'edit', Write: harness === 'pi' ? 'write' : 'edit' };
    if (!tools.length || tools.some(tool => !Object.hasOwn(names, tool))) throw new Error('Unsupported agent tool grant');
    const grants = new Set(tools.map(tool => names[tool]));
    if (grants.has('bash') && !['slice-implementer.md', 'browser-operator.md'].includes(file)) throw new Error(`Unexpected shell grant: ${file}`);
    if (file === 'browser-operator.md') for (const action of ['navigate', 'snapshot', 'take_screenshot', 'close']) grants.add(`playwright_browser_${action}`);
    return [...grants];
}

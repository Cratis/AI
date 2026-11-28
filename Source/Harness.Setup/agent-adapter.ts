// Render one native agent to stdout during corpus sync. No writes or implicit tool grants.
import { readFileSync } from 'node:fs';
const [harness, file] = process.argv.slice(2);
const source = readFileSync(file, 'utf8');
const [, header, body] = source.split(/^---$/m);
const tools = [...header.matchAll(/^  - (Read|Grep|Glob|Edit|Write)$/gm)].map(match => match[1].toLowerCase());
if (harness === 'pi') {
    console.log(`---${header.replace(/tools:\n(?:  - \w+\n)+/, `tools: ${tools.map(t => t === 'glob' ? 'find' : t).join(', ')}\n`)}---${body.trimEnd()}`);
} else if (harness === 'opencode') {
    const description = header.match(/^description: .*$/m)![0];
    const grants = tools.filter(t => t !== 'write').map(t => `  ${t}: allow`).join('\n');
    console.log(`---\n${description}\nmode: subagent\npermission:\n  "*": deny\n${grants}\n---${body.trimEnd()}`);
} else throw new Error('Expected pi or opencode');

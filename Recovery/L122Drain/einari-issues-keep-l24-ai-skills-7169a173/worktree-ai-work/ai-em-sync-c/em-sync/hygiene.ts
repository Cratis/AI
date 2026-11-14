import { readFileSync, readdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { skillHygieneFindings } from '../../Source/Verification/skill-hygiene.ts';
const root = resolve(import.meta.dirname, '../..');
const skills = ['cratis-screenplay-render-and-gap-fill', 'cratis-application-slice-conformance', 'cratis-application-slice-specifications', 'cratis-chronicle-reactor', 'cratis-chronicle-read-model-specifications'];
for (const skill of skills) {
 const directory = resolve(root, '.cratis/ai/skills', skill);
 for (const file of [resolve(directory, 'SKILL.md'), ...readdirSync(resolve(directory, 'references')).filter(f => f.endsWith('.md')).map(f => resolve(directory, 'references', f))]) {
  const name = relative(root, file);
  console.log(`${name}\t${skillHygieneFindings(name, readFileSync(file, 'utf8')).length}`);
 }
}

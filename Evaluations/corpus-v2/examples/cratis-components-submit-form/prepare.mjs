import { access, cp } from 'node:fs/promises';
const source = '../cratis-arc-generate-proxies/generated';
await access(`${source}/Features/Authors/Registration/RegisterAuthor.ts`);
await cp(source, 'generated', { recursive: true });

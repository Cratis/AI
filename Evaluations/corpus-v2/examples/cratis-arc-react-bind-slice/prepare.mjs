import { access, cp } from 'node:fs/promises';
const source = '../cratis-arc-generate-proxies/generated';
await access(`${source}/Features/Authors/Listing/Author.ts`);
await cp(source, 'generated', { recursive: true });

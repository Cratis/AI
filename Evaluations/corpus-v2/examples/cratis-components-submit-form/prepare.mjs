import {cp,access} from 'node:fs/promises';
const source='../cratis-arc-generate-proxies/generated';
for(const f of ['Authors/Author.ts','Authors/RegisterAuthor.ts']) await access(source+'/'+f);
await cp(source,'generated',{recursive:true});

import { useState } from 'react';
import { SchemaDraft } from './Features/Schemas/SchemaDraft';
import { AuthorDocument } from './Features/Authors/AuthorDocument';
import type { Json, JsonSchema } from '@cratis/components/SchemaEditor';
export const View = () => {
    const [schema, setSchema] = useState<JsonSchema>({type: 'object', properties:{name:{type:'string'}}, required:['name']});
    const [saved, save] = useState<Json>({ name: 'Draft' });
    return <><AuthorDocument initial={saved} schema={schema} save={save} /><output>{JSON.stringify(saved)}</output>
        <details><summary>Contract</summary><pre>{JSON.stringify(schema)}</pre></details>
        <details><summary>Edit schema draft</summary><SchemaDraft initial={schema} save={setSchema} /></details></>;
};

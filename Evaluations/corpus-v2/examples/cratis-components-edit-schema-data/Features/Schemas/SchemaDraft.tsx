import { useState } from 'react';
import { SchemaEditor, type JsonSchema } from '@cratis/components/SchemaEditor';

export function SchemaDraft({ initial, save }: { initial: JsonSchema; save: (schema: JsonSchema) => void }) {
    const [schema, setSchema] = useState(initial);
    return <SchemaEditor schema={schema} onChange={setSchema} onSave={() => save(schema)} />;
}

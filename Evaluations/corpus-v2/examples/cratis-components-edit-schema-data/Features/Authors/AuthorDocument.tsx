import { useState } from 'react';
import type { Json, JsonSchema } from '@cratis/components/SchemaEditor';
import { ObjectContentEditor } from '@cratis/components/ObjectContentEditor';

export function AuthorDocument({ initial, schema, save }: { initial: Json; schema: JsonSchema; save: (doc: Json) => void }) {
    const [author, setAuthor] = useState(initial);
    const [hasErrors, setHasErrors] = useState(false);
    return <><ObjectContentEditor object={author} schema={schema} editMode
        onChange={setAuthor} onValidationChange={setHasErrors} />
        <button disabled={hasErrors} onClick={() => save(author)}>Save</button></>;
}

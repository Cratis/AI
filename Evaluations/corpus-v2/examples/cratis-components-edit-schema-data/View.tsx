import { useState, type ComponentProps } from 'react';
import { ObjectContentEditor } from '@cratis/components/ObjectContentEditor';
const schema = { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] };
export function View() {
    const [data, edit] = useState<ComponentProps<typeof ObjectContentEditor>['object']>({ name: 'Draft' });
    const [invalid, flag] = useState(false);
    return <><ObjectContentEditor schema={schema} object={data} editMode onChange={edit} onValidationChange={flag}/>
        <button disabled={invalid}>Save</button><output>{JSON.stringify(data)}</output>
        <details><summary>Contract</summary><pre>{JSON.stringify(schema)}</pre></details></>;
}

---
name: cratis-components-edit-schema-data
compatibility: Requires React and Cratis Components.
description: Use when choosing SchemaEditor to edit a schema or ObjectContentEditor to edit data against it. Not for a fixed command form (cratis-components-submit-form).
---

# Edit values against a schema

Use ObjectContentEditor when the outgoing document is data. Keep its schema as a separate input and let validity decide whether the host permits a save.

Use the component subpath imports below. If the installed declarations lack one of these props, inspect the package export and the host renderer before changing the interaction.

1. Identify the document being persisted and retain a separate schema. **Done:** The initial object has a string name and the schema declares that member required.
2. Feed onChange back as the object and onValidationChange to the save gate. **Done:** A valid edit appears in the emitted data without replacing the schema.
3. Clear the required field, observe its invalid state and inspect the schema again. **Done:** Aster was emitted as data, the empty name blocks Save, and the original schema remains unchanged.

## Example

Mount this view inside the configured application host.

```tsx
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
```

If edits disappear, inspect the object supplied on the next render; feeding the initial object back discards the emission. If a schema property is being renamed, switch editors instead of mutating schema inside a value callback.

Read references/schema-authoring.md when the schema itself is the deliverable.

## Verify

Run `npx tsc --noEmit` in the frontend, then edit a required value and clear it. The valid edit updates the emitted object, clearing it blocks Save and neither edit changes the original schema.

---
name: cratis-components-edit-schema-data
description: Use when a developer lets users edit a runtime JSON schema with SchemaEditor or change one document's values with ObjectContentEditor. Not for known command fields (use cratis-components-submit-form).
compatibility: Requires react and @cratis/components.
---

# Edit a schema or a document

These paths are for the Library example; in other apps, put the components in the owning slices.

1. Use `SchemaEditor` to change which properties exist. Put `SchemaDraft.tsx` in `Features/Schemas`, inside `CratisComponentsProvider` from `@cratis/components`. Pass the existing schema and the application's save operation.

```tsx
import { useState } from 'react';
import { SchemaEditor, type JsonSchema } from '@cratis/components/SchemaEditor';

export function SchemaDraft({ initial, save }: { initial: JsonSchema; save: (schema: JsonSchema) => Promise<void> }) {
    const [saved, setSaved] = useState(initial);
    const [draft, setDraft] = useState(initial);
    const [saving, setSaving] = useState(false);
    const [failed, setFailed] = useState(false);
    async function persist() {
        setSaving(true);
        setFailed(false);
        try {
            await save(draft);
            setSaved(draft);
        } catch { setFailed(true); }
        finally { setSaving(false); }
    }
    return <><SchemaEditor canEdit={!saving} schema={draft} onChange={setDraft}
        onSave={persist} onCancel={() => { setDraft(saved); setFailed(false); }} />
        {failed && <p role="alert">Save failed. Choose Edit to retry or cancel.</p>}</>;
}
```

2. Choose `ObjectContentEditor` instead when the user edits one document's values without changing its shape. Put `AuthorDocument.tsx` in `Features/Authors`. Keep the authoritative schema fixed. `ObjectContentEditor` reports a missing top-level optional field as an error if that field is included in its editor schema. For a surface that edits only existing optional values, omit absent optional fields from the editor schema, not from the authoritative validator. Here `penName` is optional and a document without it can still be saved.

```tsx
import { useState } from 'react';
import type { Json, JsonSchema } from '@cratis/components/SchemaEditor';
import { ObjectContentEditor } from '@cratis/components/ObjectContentEditor';

const authorSchema: JsonSchema = {
    type: 'object', required: ['name'],
    properties: { name: { type: 'string' }, penName: { type: 'string' } },
};

export function AuthorDocument({ validate, save }: { validate: (doc: Json, schema: JsonSchema) => boolean; save: (doc: Json) => void }) {
    const [author, setAuthor] = useState<Json>({ name: 'Aster' });
    const [hasErrors, setHasErrors] = useState(false);
    const editorSchema: JsonSchema = {
        type: 'object', properties: { name: { type: 'string' } },
    };
    const canSave = !hasErrors && validate(author, authorSchema);
    return <><ObjectContentEditor object={author} schema={editorSchema} editMode
        onChange={setAuthor} onValidationChange={setHasErrors} />
        <button type="button" disabled={!canSave} onClick={() => save(author)}>Save</button></>;
}
```

## Avoid

- Don't change the schema when editing a document value. `onChange` on `ObjectContentEditor` returns the changed document.
- Don't treat a draft edit as a save. Persist only when the caller's `save` operation runs.

## When it goes off the usual path

- **Save stays disabled after editing a property:** check that its name matches `^[a-zA-Z_][a-zA-Z0-9_]*$`, is not `__proto__`, `constructor` or `prototype`, and is unique among siblings.
- **Cancel leaves draft fields behind:** the default table editor tracks the `schema` prop, which may already include unsaved changes. Keep the last saved schema separate from the draft. The host's `save` must reject on failure. As a one-off check, save a change, edit again, then cancel: the first change should remain without another save.
- **An external schema uses richer keywords or shapes:** check that they fit the editor's JSON Schema subset before editing. For example, the editor cannot author tuple-valued `items`. Validate the saved result with the application's authoritative validator when external constraints matter.

## Related skills

- [Bind a known command field](../cratis-components-submit-form/SKILL.md)

For controlled schema changes and object validation, read [controlled-editor.md](references/controlled-editor.md).

---
name: cratis-components-edit-schema-data
description: Use when a developer lets users edit a runtime JSON schema with SchemaEditor or change one document's values with ObjectContentEditor. Not for known command fields (use cratis-components-submit-form).
compatibility: Requires react and @cratis/components.
---

# Edit a schema or a document

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

2. Choose `ObjectContentEditor` instead when the user edits one document's values without changing its shape. Put `AuthorDocument.tsx` in `Features/Authors`. Keep the schema fixed and set `editMode` on `ObjectContentEditor`. Treat `onValidationChange(true)` as `hasErrors`, not as validity.

```tsx
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

For editing and cancelling a controlled schema, read [controlled-editor.md](references/controlled-editor.md).

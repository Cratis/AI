# Editing and cancelling a controlled schema

Keep a saved document distinct from the draft. The table’s `editMode` initializes its local state; a changed `schema` input replaces both working copy and baseline. Do not feed each draft change back as a newly saved schema. `onSave()` carries no document: commit the tracked draft. Cancel restores the baseline, sends `onChange` with source `reset` only if different, then calls `onCancel`.

The tree edits live. With controlled `properties`, supply each mutation callback whose operation should be offered. Convert with `jsonSchemaToProperties` and `propertiesToJsonSchema` rather than rebuilding name/type pairs: preserve keywords on both properties and array items and keep parent `required`. The editor supports a subset, not arbitrary reference resolution. For instance data, validate against the real schema separately; the root-scalar edit surface is not an external schema validator.

## Validate object edits at the host boundary

`ObjectContentEditor` edits top-level scalars and reports field errors only in edit mode. It checks all included top-level properties regardless of the schema's `required` array. Use the full authoritative schema to validate what will be saved, not just `onValidationChange`. If the user must be able to add or remove optional values, use a form that represents their absence; the scalar editor's field error is not proof that the document violates the schema.

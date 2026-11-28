# Command state and refusal

Treat the form as an editable draft. `hasChanges` compares it with the baseline; `revertChanges()` restores that baseline. A `CommandScope` executes its changed commands, not every command rendered beneath it. Do not interpret validation feedback as permission to execute: authorization and protected reads can still refuse the action. Preserve the draft and release busy state on refusal.

Sign in and out through the actual identity provider, then refresh the displayed caller. Do not ask for a caller ID in the form. Availability is an affordance: keep an undecided action distinct from a known unavailable one, and never invoke a disabled action. The server must still authorize every execution.

Only a missing identity endpoint (404) permits cookie fallback; never treat 401 or 403 as “try a cached identity”. Clear presentation state on account changes. With no availability provider the app opts out; with one, the initial decision is unknown. Keep a last good decision distinct from an initial failure. Use `RequireAvailable` for waiting or unavailable content, not as execution authorization.

Opt in to throttled `autoServerValidate` for early feedback, not a promise of execution. Trace displayed values to the read model and submitted properties to the generated command. A `GuidField` edits a supplied identifier; it does not generate one. Register the field provider before asking `AutoCommandForm` to generate fields.

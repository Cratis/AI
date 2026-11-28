# Submit a query from a Scene web form

Use `Cratis.Components:queryInputForm` when the user supplies explicit string arguments to an optional-single Arc query and needs a scalar result. For example, look up one project's name by the project ID. Do not use the adapter to fetch every project and filter in the browser. Provide the real generated query constructor and the correct Arc runtime context; a form declaration does not discover either.

1. With the project's generated `ProjectName` proxy, call `registerQueryIdentity('ProjectName', 'Projects/Queries/ProjectName', ProjectName)` from `@cratis/scene.components`. The second argument identifies the generated source, **not** an entered project ID. Use the actual model's unique name and identity.
2. On the external component set `query: 'ProjectName'`, `inputs: [{ parameter: 'projectId', type: 'string', label: 'Project identifier' }]` and `resultField: 'name'` for a proxy with that parameter and scalar field. Names are case-sensitive. If resolution is ambiguous, fix the binding rather than inventing a route. A collection-returning query is not an optional-single lookup.
3. Enter a known project ID. Typing updates drafts, not query arguments. Submit by button or Enter. Submission validates the fields, commits the arguments and passes them to the same result runtime as `singleResult`. Editing again clears the committed result; a late reply from the old request must not reappear as the answer for the new draft.

Check a known result, an authorized missing record and a rejected request separately. The web component does not supply a command context, an expression engine or cross-component data binding. A passing lookup is not proof of live delivery for another observable screen.

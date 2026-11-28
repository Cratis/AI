# Choosing and removing collection items

Treat ComboBox selection and text as separate state: `value` is the selected key or `null`; `inputValue` is a search draft. For remote search control the draft, set `filter="none"`, and show loading or failure for the current request only. Drop stale responses. The footer receives the draft text; it does not select a newly created option automatically.

For a string list, `onChange` supplies the next array. Turning off `editable` hides the entry field but does not prohibit removal. Use `disabled` or a display-only surface when the user may not change the list. When equal labels can recur, remove the selected occurrence, not every matching string.

Use ToggleGroup for a value, Tabs for the ID of a real panel. Neither selection callback is a navigation event. Update the owner’s state explicitly.

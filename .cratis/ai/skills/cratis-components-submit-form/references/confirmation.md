# Confirming a command without double close

Use a plain dialog for a noncommand response, a command dialog for one submission, and registered global feedback for a shared busy or confirmation presentation. Mount the wrapper returned by `useDialog` once. The caller awaits the dialog result and optional response; the content reads its request and close function from context. Avoid closing both from the host and again from the content.

A successful execution invokes `onSuccess` before the post-success close decision. Return a boolean on every close-validation path. When supplying a custom response through context, close once and suppress automatic close. On refusal leave the draft intact. Choose Cancel or content focus for destructive confirmations so an unintentional Enter cannot approve the action.

A field binding such as `value={c => c.name}` identifies a command property. A computed expression or unregistered raw input is not an equivalent binding. Use a registered field wrapper for custom controls and register a field provider before relying on auto-generation.

Specifically, post-success `onConfirm` permits close only for literal `true`; without that handler, `onClose(DialogResult.Ok)` vetoes on `false`. `buttons={null}` leaves content only. Do not re-enable backdrop or Escape dismissal while the submission is busy.

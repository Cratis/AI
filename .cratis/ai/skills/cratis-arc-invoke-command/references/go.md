# Execute through the command pipeline

Use the built command pipeline and current context, for example `result, err := commands.Execute[string](ctx, pipeline, command)`. First handle `err` (including cancellation); then inspect `result.IsSuccess()` before taking the response. A nil Go error can accompany an unauthorized or invalid result. Inspect the envelope instead of manufacturing a successful HTTP status. `Response()` reports presence separately: an empty string or zero can be a valid response. Never turn absence into a fabricated scalar.

Use the envelope’s `StatusCode()` rather than guessing from the response value: success wins (200), then unauthorized (403), invalid (400), otherwise exception (500).

# One submission across several steps

Use `StepperCommandDialog`, `CommandStepper` and `StepperPanel` from `@cratis/components/CommandDialog`. Use the embedded stepper when no dialog chrome is needed. Bind every field to the same command instance, with each property on one named step. Otherwise the user can be blocked by a validation error with no identifiable step to fix.

A linear header cannot jump. Invalid fields on the current step block forward progress, not Back. `onChangeStep({index})` describes an accepted move, not a request. Keep the built-in navigation when changing labels so that keyboard and click paths share the validation gate. The last-step submit remains rendered but disabled while invalid or busy.

Set prerequisites in `initialValues`; apply late updates through `currentValues`. If `onBeforeExecute` transforms values, return them. `confirmBeforeExecute` must approve the submitted values with literal `true`; a stale approval is not approval for an edited draft. On refusal leave the draft available and do not bypass the busy dismissal guard. Style the outer dialog with `dialogPt` or `dialogClassName`, the stepper with `pt` or `className`.

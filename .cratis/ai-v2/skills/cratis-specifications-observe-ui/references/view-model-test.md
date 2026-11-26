# Test a nonvisual decision at the model

Inject a recording command dependency and exercise one action on the view model. Check the captured arguments and resulting model state, then dispose subscriptions. This can prove a command is not repeated after cancellation; it cannot prove the button is labeled, focus is restored, or a screen renders that state. Keep one rendered interaction for each such user-facing claim.

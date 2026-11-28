# Enroll a reservation in a Go command

With `github.com/cratis/arc.go/commands`, make `reserveSeat` an operation with a `CommandOperation()` marker. Its `Execute(ctx, service)` reserves by reservation ID; `Compensate(ctx, service, failure)` cancels only that reservation. Both return an error. Return the declaration rather than calling either method:

```go
func (c bookSeat) Handle(context.Context) (commands.Outcome[string], error) {
    return commands.Respond(c.ReservationID, reserveSeat(c)), nil
}
```

Register `commands.RegisterOperation[reserveSeat, seatReservations]` with the registry and a scoped service resolver. Include `commands.WithOperations[bookSeat]()` when registering the handler, checking both registration errors before building. Calling the handler directly should reserve nothing; executing through the pipeline should reserve once. Test a failed attempt with a known noncommit and verify cancellation by ID. When the commit is uncertain, reconcile instead of retrying cancellation.

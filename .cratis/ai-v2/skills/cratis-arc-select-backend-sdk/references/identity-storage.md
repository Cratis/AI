# Admit adapters separately

A typed reply from a command does not establish who dispatched it, which namespace it addressed, or whether anything was stored. For identity admission, require the native host's trusted principal adapter and a refusal test for a caller without the grant. A source ID or tenant header is not that grant.

For storage, identify the native adapter and read back from its disposable backing store, not from the returned response. For a scalar crossing the Go wire, require a round trip of the actual scalar type. Neither a string response nor the .NET concept converter proves that encoding. If only a generated transport or schema exists, report the missing adapter or round trip; do not claim persistence.

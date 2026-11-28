# Select the Go module for the host

For a standalone service using Go 1.26, add the application module in the service's module directory. For example:

```sh
go get github.com/cratis/chronicle.go@v0.28.2
```

Inspect the resolved module graph: the client module, not just generated protocol types, should be available to the worker. If Arc owns the host, `github.com/cratis/arc.go/integrations/chronicle` is a separate module. No integration-module tag is available for the verified Arc release. Use the standalone client or defer integration until the host has a verified module/version pair. Do not assume the Arc root tag includes that nested module or force the standalone version into the integration. Verify the required operation against the intended kernel; Go module and kernel release numbers are not compatibility tests.

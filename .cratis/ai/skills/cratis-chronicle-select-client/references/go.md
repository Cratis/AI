# Inspect the Go event contract

With Go 1.26 or later, run `go mod init example.org/library` in an empty directory, then `go get github.com/cratis/chronicle.go@v0.17.0`. The module includes its own generated contracts. Save as `main.go`:

```go
package main

import (
    "fmt"
    "github.com/cratis/chronicle.go/contracts/eventtypes"
)

func main() {
    event := &eventtypes.EventType{Id: "AuthorRegistered", Generation: 1}
    fmt.Println(event.GetId(), event.GetGeneration())
}
```

`go run .` prints `AuthorRegistered 1` without reaching a kernel. Check the tagged module's stated kernel version before choosing it for your deployment. This offline check does not demonstrate support for decision reads. For the client's supported kernel, run its tagged `examples/getting-started` program against its matching development image to check a real append. If a real append loses its acknowledgement, reconcile with history before retrying; a transport error isn't a refusal.

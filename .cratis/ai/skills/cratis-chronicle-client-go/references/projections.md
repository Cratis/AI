<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Model-bound Go projections

Source: Chronicle.Go `registry_readmodels.go`,
`registry_projections.go`, `projections/declaration.go` and the
[projection example](https://github.com/Cratis/Chronicle.Go/blob/main/examples/projections/main.go).
This complete package declares a projection; it does not connect or append:

```go
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

package inventory

import (
	"time"

	chronicle "github.com/cratis/chronicle.go"
	"github.com/cratis/chronicle.go/events"
	"github.com/cratis/chronicle.go/projections"
	"github.com/cratis/chronicle.go/readmodels"
)

// ProductRegistered records a new product's description.
type ProductRegistered struct {
	ProductName string `json:"productName"`
	Description string `json:"description"`
}

// Inventory is materialized by the kernel from registered events.
type Inventory struct {
	ID          string    `json:"id" chronicle:"key"`
	ProductName string    `json:"productName"`
	Description string    `json:"description" chronicle:"set(@registered)"`
	State       string    `json:"state" chronicle:"value(@registered,value=\"available\")"`
	Registered  time.Time `json:"registered" chronicle:"context(@registered,from=occurred)"`
}

// Declarations returns the registry and typed read-model handle.
func Declarations() (*chronicle.Registry, readmodels.Model[Inventory], error) {
	registry := chronicle.NewRegistry()
	registered, err := chronicle.RegisterEvent[ProductRegistered](registry,
		events.WithID("product-registered"))
	if err != nil {
		return nil, readmodels.Model[Inventory]{}, err
	}
	model, err := chronicle.RegisterReadModel[Inventory](registry)
	if err != nil {
		return nil, model, err
	}
	projection := projections.ModelBound(model,
		projections.BindEvent("registered", registered),
		projections.FromEvent(registered))
	return registry, model, registry.AddProjection(projection)
}
```

`chronicle:"key"` binds event-source identity. `FromEvent` enables AutoMap by
default (`ProductName` maps by name); `BindEvent` gives mapping tags a local
alias. `set` copies a property, `value` sets a constant, and `context` selects
metadata. Registration checks errors before client construction.

Pass the registry to `WithRegistry`. Use the typed handle with
`readmodels.For(store.ReadModels(), model)` and `Get(ctx, id)`; inspect both the
error and `instance.Exists`, not a zero value as proof of presence. Materialization
is eventually consistent. The tagged example includes a bounded read wait and
prints the materialized state. Do not infer catch-up from registration alone.

For shapes tags cannot express, define a separate untagged model and use
`projections.NewBuilder`/typed mapping helpers. A reducer is the procedural escape
hatch, not the first choice for event-to-property mapping.

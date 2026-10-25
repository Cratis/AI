<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Explicit Go query adapters

Source: Arc.Go, `queries/registration.go`, `queries/example_test.go`
and `queries/paging.go`. This complete package builds and executes a snapshot
pipeline; it does not start an HTTP host:

```go
// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

package authors

import (
	"context"
	"fmt"

	"github.com/cratis/arc.go/metadata"
	"github.com/cratis/arc.go/queries"
)

// Author is the owning read model.
//arc:readmodel
type Author struct {
	Name string `json:"name"`
}

// All is a static-equivalent query; it uses no receiver state.
func (Author) All(context.Context, queries.NoArguments) ([]Author, error) {
	return []Author{{Name: "Ada"}}, nil
}

// ReadAuthors explicitly authorizes a public example query and checks its outcome.
func ReadAuthors(ctx context.Context) ([]Author, error) {
	var registry queries.Registry
	if err := queries.Register[Author](&registry, "All",
		queries.Function(Author{}.All),
		queries.WithAuthorization[queries.NoArguments](
			metadata.Authorization{AllowAnonymous: true})); err != nil {
		return nil, err
	}
	pipeline, err := registry.Build(queries.PipelineOptions{})
	if err != nil {
		return nil, err
	}
	result, err := queries.Perform[[]Author](ctx, pipeline,
		"Author.All", queries.Request{})
	if err != nil {
		return nil, err
	}
	if !result.IsSuccess() {
		return nil, fmt.Errorf("author query failed with status %d", result.StatusCode())
	}
	data, present := result.Data()
	if !present {
		return nil, fmt.Errorf("author query returned no data")
	}
	return data, nil
}
```

The expected result is one `Author{Name: "Ada"}`. This public example opts into
anonymous access deliberately; use an explicit authorization policy for private
queries. `//arc:readmodel` documents the model, but handwritten registration is
what activates this package. The same `queries.Register` accepts a root builder
when composing HTTP endpoints.

For server-side paging, adapt with `queries.WithParameters` and return a
`queries.Page[Author]` containing items plus total count; do not fetch an unbounded
collection just to slice it in memory. The tagged `queries/example_test.go`
demonstrates parameter binding and paged results.

For observables, `queries.RegisterObservable` records the emission type separately
from `observable.Source` ownership and rendered client data. Preserve authorization
and validation guards on every emission, cancellation, terminal errors and cleanup.
Read the [source and examples](https://github.com/Cratis/Arc.Go/tree/main/queries)
for the exact source/renderer profile instead of assuming channels, providers or
unpublished generators share one registration contract.

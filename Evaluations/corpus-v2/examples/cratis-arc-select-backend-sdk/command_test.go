package admission_test

import (
	"context"
	"testing"

	"github.com/cratis/arc.go/commands"
)

type ConfirmName struct{ Name string }

func (c ConfirmName) Handle(context.Context) (string, error) { return c.Name, nil }

func TestNativeReply(t *testing.T) {
	var registry commands.Registry
	if err := commands.Register(&registry, commands.Handle(ConfirmName.Handle)); err != nil {
		t.Fatal(err)
	}
	pipeline, err := registry.Build(commands.PipelineOptions{})
	if err != nil {
		t.Fatal(err)
	}
	result, err := commands.Execute[string](context.Background(), pipeline, ConfirmName{Name: "Aster"})
	if err != nil {
		t.Fatal(err)
	}
	value, present := result.Response()
	if !result.IsSuccess() || !present || value != "Aster" {
		t.Fatalf("unexpected reply: success=%t present=%t value=%q", result.IsSuccess(), present, value)
	}
}

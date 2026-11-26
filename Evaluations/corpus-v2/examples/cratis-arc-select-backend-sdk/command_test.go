package authors_test

import (
	"context"
	"testing"

	"github.com/cratis/arc.go/commands"
)

type AuthorId string
type RegisterAuthor struct {
	Id AuthorId
	Name string
}
type AuthorRegistered struct{ Name string }

func (c RegisterAuthor) Handle(context.Context) (AuthorRegistered, error) {
	return AuthorRegistered{Name: c.Name}, nil
}

func TestNativeReply(t *testing.T) {
	var registry commands.Registry
	if err := commands.Register(&registry, commands.Handle(RegisterAuthor.Handle)); err != nil {
		t.Fatal(err)
	}
	pipeline, err := registry.Build(commands.PipelineOptions{})
	if err != nil {
		t.Fatal(err)
	}
	result, err := commands.Execute[AuthorRegistered](context.Background(), pipeline, RegisterAuthor{Id: "11111111-1111-4111-8111-111111111111", Name: "Aster"})
	if err != nil {
		t.Fatal(err)
	}
	value, present := result.Response()
	if !result.IsSuccess() || !present || value.Name != "Aster" {
		t.Fatalf("unexpected reply: success=%t present=%t value=%v", result.IsSuccess(), present, value)
	}
}

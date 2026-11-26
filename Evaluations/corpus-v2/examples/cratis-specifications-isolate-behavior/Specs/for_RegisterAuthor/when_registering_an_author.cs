using Cratis.Specifications;
using Library.Features.Authors;
using Library.Features.Authors.Registration;
using Xunit;

namespace Library.Specs.for_RegisterAuthor;

public class when_registering_an_author : Specification
{
    RegisterAuthor _command = null!;
    AuthorRegistered _event = null!;

    void Establish() => _command = new(AuthorId.New(), "Aster");
    void Because() => _event = _command.Handle();

    [Fact] public void should_return_the_submitted_name() => _event.Name.ShouldEqual("Aster");
}

using System;
using Cratis.Arc.Commands.ModelBound;
using Cratis.Chronicle.Events;
using Cratis.Specifications;
using Library.Features.Authors;
using Library.Features.Authors.Registration;
using Xunit;

namespace Library.Features.Authors
{
    public record AuthorId(Guid Value) : EventSourceId<Guid>(Value)
    {
        public static AuthorId New() => new(Guid.NewGuid());
    }
}

namespace Library.Features.Authors.Registration
{
    [Command]
    public record RegisterAuthor(AuthorId Id, string Name)
    {
        public AuthorRegistered Handle() => new(Name);
    }

    [EventType]
    public record AuthorRegistered(string Name);
}

namespace Library.Specs.for_RegisterAuthor
{
    public class when_registering_an_author : Specification
    {
        RegisterAuthor _command = null!;
        AuthorRegistered _event = null!;

        void Establish() => _command = new(AuthorId.New(), "Aster");
        void Because() => _event = _command.Handle();

        [Fact] public void should_return_the_submitted_name() => _event.Name.ShouldEqual("Aster");
    }
}

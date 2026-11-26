using System;
using System.Linq;
using System.Threading.Tasks;
using Cratis.Arc.Chronicle.Testing.Commands;
using Cratis.Arc.Commands;
using Cratis.Arc.Commands.ModelBound;
using Cratis.Arc.Testing.Commands;
using Cratis.Chronicle.Events;
using Cratis.Specifications;
using FluentValidation;
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

    public class RegistrationValidator : CommandValidator<RegisterAuthor>
    {
        public RegistrationValidator() => RuleFor(x => x.Name).NotEmpty();
    }

    [EventType]
    public record AuthorRegistered(string Name);
}

namespace Library.Specs.for_RegisterAuthor
{
    public class when_submitting_an_empty_name : Specification
    {
        readonly CommandScenario<RegisterAuthor> _scenario = new();
        CommandResult _result = null!;
        async Task Because() => _result = await _scenario.Execute(new RegisterAuthor(AuthorId.New(), ""));
        async Task Destroy() => await _scenario.DisposeAsync();

        [Fact] public void should_refuse_the_name() =>
            Assert.Contains(_result.ValidationResults, e => e.Members.Contains("name", StringComparer.OrdinalIgnoreCase));
        [Fact] public async Task should_not_append_an_event() => await _scenario.ShouldNotHaveAppendedEvents();
    }

    public class when_executing_author_registration : Specification
    {
        readonly CommandScenario<RegisterAuthor> _scenario = new();
        readonly AuthorId _id = AuthorId.New();
        CommandResult _result = null!;

        async Task Because() => _result = await _scenario.Execute(new RegisterAuthor(_id, "Aster"));
        async Task Destroy() => await _scenario.DisposeAsync();

        [Fact] public void should_accept_registration() => _result.ShouldBeSuccessful();
        [Fact] public async Task should_record_the_name_on_the_requested_author() =>
            await _scenario.ShouldHaveAppendedEvent<RegisterAuthor, AuthorRegistered>(_id, x => x.Name == "Aster");
    }
}

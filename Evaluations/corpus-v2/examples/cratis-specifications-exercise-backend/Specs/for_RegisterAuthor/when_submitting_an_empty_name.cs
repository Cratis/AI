using System.Threading.Tasks;
using Cratis.Arc.Chronicle.Testing.Commands;
using Cratis.Arc.Commands;
using Cratis.Arc.Testing.Commands;
using Cratis.Specifications;
using Library.Features.Authors;
using Library.Features.Authors.Registration;
using Xunit;

namespace Library.Specs.for_RegisterAuthor;

public class when_submitting_an_empty_name : Specification
{
    readonly CommandScenario<RegisterAuthor> _scenario = new();
    CommandResult _result = null!;

    void Establish() => _scenario.Given.ForEventSource(AuthorId.New()).Events(new AuthorRegistered("Aster"));
    async Task Because() => _result = await _scenario.Execute(new RegisterAuthor(AuthorId.New(), ""));
    void Destroy() => _scenario.Dispose();

    [Fact] public void should_refuse_registration() => _result.ShouldNotBeSuccessful();
    [Fact] public void should_explain_the_refusal() =>
        _result.ShouldHaveValidationErrorFor("Name is required");
    [Fact] public async Task should_not_append_an_event() => await _scenario.ShouldNotHaveAppendedEvents();
}

using System.Threading.Tasks;
using Cratis.Arc.Chronicle.Testing.Commands;
using Cratis.Arc.Commands;
using Cratis.Arc.Testing.Commands;
using Cratis.Specifications;
using Library.Features.Authors;
using Library.Features.Authors.Registration;
using Xunit;

namespace Library.Specs.for_RegisterAuthor;

public class when_executing_author_registration : Specification
{
    readonly CommandScenario<RegisterAuthor> _scenario = new();
    readonly AuthorId _id = AuthorId.New();
    CommandResult _result = null!;

    async Task Because() => _result = await _scenario.Execute(new RegisterAuthor(_id, "Aster"));
    void Destroy() => _scenario.Dispose();

    [Fact] public void should_accept_registration() => _result.ShouldBeSuccessful();
    [Fact] public async Task should_record_the_name_on_the_requested_author() =>
        await _scenario.ShouldHaveAppendedEvent<RegisterAuthor, AuthorRegistered>(_id, e => e.Name == "Aster");
}

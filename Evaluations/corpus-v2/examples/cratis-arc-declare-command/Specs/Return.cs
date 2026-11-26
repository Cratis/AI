using Catalog.Authors;
using Cratis.Arc.Chronicle.Testing.Commands;
using Cratis.Arc.Testing.Commands;
using System.Security.Claims;
using Xunit;

public class Return
{
    [Fact] public async Task returns_one_fact_to_the_selected_source()
    {
        await using var scenario = new CommandScenario<RegisterAuthor>();
        scenario.WithClaims(new Claim(ClaimTypes.Role, "catalog-editor"));
        var id = AuthorId.New();
        var command = new RegisterAuthor(id, "Aster");
        var result = await scenario.Execute(command);
        Assert.True(result.IsSuccess);
        await scenario.ShouldHaveAppendedEventsInOrder(new AuthorRegistered("Aster"));
        await scenario.ShouldHaveAppendedEvent<RegisterAuthor, AuthorRegistered>(id, e => e.Name == "Aster");
    }
}

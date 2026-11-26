using Catalog.Authors;
using Cratis.Arc.Commands.ModelBound;
using Cratis.Arc.Chronicle.Testing.Commands;
using Cratis.Arc.Testing.Commands;
using System.Security.Claims;
using Xunit;

namespace Catalog.ProtectedAuthors;

[Command]
[Cratis.Arc.Authorization.Authorize(Roles = "catalog-editor")]
public record RegisterAuthor(AuthorId Id, string Name)
{
    public AuthorRegistered Handle() => new(Name);
}

public class Access
{
    [Theory][InlineData(null, false)][InlineData("reader", false)][InlineData("catalog-editor", true)]
    public async Task only_an_editor_can_write(string? role, bool granted)
    {
        await using var scenario = new CommandScenario<RegisterAuthor>();
        if (role is null) scenario.Unauthenticated(); else scenario.WithClaims(new Claim(ClaimTypes.Role, role));
        var result = await scenario.Execute(new RegisterAuthor(new(Guid.NewGuid()), "Aster"));
        Assert.Equal(granted, result.IsAuthorized);
        Assert.Equal(granted, result.IsSuccess);
        if (granted) await scenario.ShouldHaveAppendedEventsInOrder(new AuthorRegistered("Aster"));
        else await scenario.ShouldNotHaveAppendedEvents();
    }
}

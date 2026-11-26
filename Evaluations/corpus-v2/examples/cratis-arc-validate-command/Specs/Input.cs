using Library.Features.Authors.Registration;
using Cratis.Arc.Chronicle.Testing.Commands;
using Cratis.Arc.Testing.Commands;
using System.Security.Claims;
using Xunit;

public class Input
{
    [Theory][InlineData("", false)][InlineData("   ", false)][InlineData("Aster", true)]
    public async Task checks_member_before_writing(string name, bool accepted)
    {
        await using var scenario = new CommandScenario<RegisterAuthor>();
        scenario.WithClaims(new Claim(ClaimTypes.Role, "catalog-editor"));
        var result = await scenario.Execute(new RegisterAuthor(new(Guid.NewGuid()), name));
        Assert.Equal(accepted, result.IsValid);
        Assert.Equal(accepted, result.IsSuccess);
        if (!accepted) Assert.Contains(result.ValidationResults.SelectMany(r => r.Members), member => string.Equals(member, "name", StringComparison.OrdinalIgnoreCase));
        if (accepted) await scenario.ShouldHaveAppendedEventsInOrder(new AuthorRegistered("Aster"));
        else await scenario.ShouldNotHaveAppendedEvents();
    }
}

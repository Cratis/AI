using Cratis.Arc.Authorization;
using Cratis.Arc.Commands;
using Cratis.Arc.Commands.ModelBound;
using Cratis.Arc.Testing.Commands;
using Microsoft.Extensions.DependencyInjection;
using System.Security.Claims;
using Xunit;

public class Writes { public List<string> Names { get; } = []; }
[Command, Authorize(Roles = "editor")]
public record Keep(string Name) { public void Handle(Writes writes) => writes.Names.Add(Name); }
public class Invocation
{
    [Theory][InlineData("reader", false)][InlineData("editor", true)] public async Task dispatch_keeps_scope(string role, bool allowed)
    {
        await using var scope = new CommandScenario<Keep>();
        var writes = new Writes();
        scope.Services.AddSingleton(writes);
        scope.WithClaims(new Claim(ClaimTypes.Role, role));
        var result = await scope.Execute(new Keep("Aster"));
        Assert.Equal(allowed, result.IsAuthorized);
        Assert.Equal(allowed ? new[] { "Aster" } : Array.Empty<string>(), writes.Names.ToArray());
    }
}

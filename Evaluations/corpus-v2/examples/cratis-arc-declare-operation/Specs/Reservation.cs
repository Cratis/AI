using Cratis.Arc.Authorization;
using Cratis.Arc.Commands;
using Cratis.Arc.Commands.ModelBound;
using Cratis.Arc.Testing.Commands;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

public sealed class Provider
{
    public HashSet<Guid> Reservations { get; } = [];
    public bool FailAfterWrite { get; init; }
}
public record Reserve(Guid AttemptId) : ICommandOperation
{
    bool inserted;
    public void Execute(Provider provider)
    {
        if (!provider.Reservations.Add(AttemptId)) throw new InvalidOperationException("Attempt already exists");
        inserted = true;
        if (provider.FailAfterWrite) throw new InvalidOperationException("Interrupted after reservation");
    }
    public void Compensate(Provider provider) { if (inserted) provider.Reservations.Remove(AttemptId); }
}
[Command, Authorize(Roles = "editor")]
public record Book { public Reserve Handle() => new(Guid.NewGuid()); }
public class Reservation
{
    [Theory][InlineData(false)][InlineData(true)] public async Task reverses_only_the_failed_attempt(bool fail)
    {
        var provider = new Provider { FailAfterWrite = fail };
        var prior = Guid.NewGuid(); provider.Reservations.Add(prior);
        await using var scenario = new CommandScenario<Book>();
        scenario.WithClaims(new System.Security.Claims.Claim(System.Security.Claims.ClaimTypes.Role, "editor"));
        scenario.Services.AddSingleton(provider);
        var result = await scenario.Execute(new Book());
        Assert.Equal(!fail, result.IsSuccess);
        Assert.Contains(prior, provider.Reservations);
        Assert.Equal(fail ? 1 : 2, provider.Reservations.Count);
        if (fail) scenario.ShouldHaveCompensatedOperation<Reserve>(); else scenario.ShouldHaveExecutedOperation<Reserve>();
    }
}

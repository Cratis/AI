using System.Security.Claims;
using Cratis.Arc.Queries;
using Cratis.Execution;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

public sealed class CatalogAccess(IReadOnlySet<string> readers) : IGuardObservableQueryEmission
{
    public Task<ObservableQueryEmissionVerdict> Guard(ObservableQueryEmissionContext context)
    {
        var actor = context.Principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var permitted = context.Principal?.Identity?.IsAuthenticated == true && actor is not null && readers.Contains(actor);
        return Task.FromResult(permitted ? ObservableQueryEmissionVerdict.Allow : ObservableQueryEmissionVerdict.DenyAndTerminate);
    }
}
public class Delivery
{
    [Fact] public async Task same_subscription_loses_access_after_revocation()
    {
        var readers = new HashSet<string>{"editor"}; var guard = new CatalogAccess(readers);
        var principal = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier,"editor")], "fixture"));
        using var services = new ServiceCollection().BuildServiceProvider();
        var frame = new ObservableQueryEmissionContext(new("Authors.AllAuthors"), QueryArguments.Empty, principal, CorrelationId.NotSet, services, true, TestContext.Current.CancellationToken);
        Assert.Equal(ObservableQueryEmissionVerdict.Allow, await guard.Guard(frame));
        readers.Remove("editor");
        Assert.Equal(ObservableQueryEmissionVerdict.DenyAndTerminate, await guard.Guard(frame with { IsFirstEmission = false }));
    }
}

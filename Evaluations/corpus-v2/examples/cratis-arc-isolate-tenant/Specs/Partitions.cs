using Cratis.Arc;
using Cratis.Arc.Http;
using Cratis.Arc.Commands;
using Microsoft.Extensions.Options;
using Cratis.Arc.Tenancy;
using System.Security.Claims;
using System.Reactive.Subjects;
using NSubstitute;
using Xunit;

public class Partitions
{
    public static async Task<CommandResult> DispatchForAuthorizedTenant(
        ITenantScope tenants, TenantId authorizedTenant, ICommandPipeline pipeline, object command)
    {
        using var selection = tenants.Begin(authorizedTenant);
        return await pipeline.Execute(command);
    }

    static string Resolve(string? claim, string? membership = null)
    {
        var context = Substitute.For<IHttpRequestContext>();
        var claims = new List<Claim>();
        if (claim != null) claims.Add(new("tenant_id", claim));
        if (membership != null) claims.Add(new("member_of", membership));
        var caller = new ClaimsPrincipal(new ClaimsIdentity(claims, "fixture"));
        context.User.Returns(caller);
        var accessor = Substitute.For<IHttpRequestContextAccessor>(); accessor.Current.Returns(context);
        var tenant = new ClaimTenantIdResolver(accessor, Options.Create(new ArcOptions())).Resolve();
        return !string.IsNullOrWhiteSpace(tenant) && new Library.Tenancy.ClaimsTenantMembership().IsMember(caller, tenant) ? tenant : throw new UnauthorizedAccessException();
    }
    [Fact] public void audience_is_captured_before_subscription()
    {
        using var first = new BehaviorSubject<string>("A:1"); using var second = new BehaviorSubject<string>("B:1");
        var scoped = new Dictionary<string, BehaviorSubject<string>> { ["A"] = first, ["B"] = second };
        var observed = new List<string>(); using var subscription = scoped[Resolve("B", "B")].Subscribe(observed.Add);
        scoped[Resolve("A", "A")].OnNext("A:1:Aster"); scoped[Resolve("B", "B")].OnNext("B:1:Birch");
        Assert.Equal(new[] {"B:1", "B:1:Birch"}, observed.ToArray());
        Assert.Throws<UnauthorizedAccessException>(() => Resolve(null));
        Assert.Throws<UnauthorizedAccessException>(() => Resolve("B", "A"));
    }
}

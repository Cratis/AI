using Cratis.Arc;
using Cratis.Arc.Http;
using Microsoft.Extensions.Options;
using Cratis.Arc.Tenancy;
using System.Security.Claims;
using System.Reactive.Subjects;
using NSubstitute;
using Xunit;

public class Partitions
{
    static string Resolve(string? claim)
    {
        var context = Substitute.For<IHttpRequestContext>();
        context.User.Returns(new ClaimsPrincipal(new ClaimsIdentity(claim is null ? [] : [new Claim("tenant_id", claim)], "fixture")));
        var accessor = Substitute.For<IHttpRequestContextAccessor>(); accessor.Current.Returns(context);
        var tenant = new ClaimTenantIdResolver(accessor, Options.Create(new ArcOptions())).Resolve();
        return string.IsNullOrWhiteSpace(tenant) ? throw new UnauthorizedAccessException() : tenant;
    }
    [Fact] public void audience_is_captured_before_subscription()
    {
        using var first = new BehaviorSubject<string>("A:1"); using var second = new BehaviorSubject<string>("B:1");
        var scoped = new Dictionary<string, BehaviorSubject<string>> { ["A"] = first, ["B"] = second };
        var observed = new List<string>(); using var subscription = scoped[Resolve("B")].Subscribe(observed.Add);
        scoped[Resolve("A")].OnNext("A:1:Aster"); scoped[Resolve("B")].OnNext("B:1:Birch");
        Assert.Equal(new[] {"B:1", "B:1:Birch"}, observed.ToArray());
        Assert.Throws<UnauthorizedAccessException>(() => Resolve(null));
    }
}

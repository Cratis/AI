using System.Net;
using System.Net.Sockets;
using Cratis.Arc.Capabilities;
using System.Security.Cryptography;
using System.Text;
using Cratis.Arc;
using Cratis.Arc.Identity.Callers;
using Cratis.Arc.Mcp;
using Cratis.Arc.PersonalAccessTokens;
using Cratis.Arc.Tenancy;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using MongoDB.Driver;

public class FixturePeople : ICallerPersonDirectory
{
    public Task<CallerPersonFound> Find(CallerAccountKey accountKey, CancellationToken cancellationToken) => Task.FromResult(CallerPersonFound.Found(new("person")));
}
internal sealed class FixtureHost : IAsyncDisposable
{
    readonly WebApplication app;
    readonly Dictionary<string,PatRecord> records = [];
    public Uri Endpoint { get; }
    public string Reader { get; }
    public string Other { get; }

    public FixtureHost()
    {
        using var reservation = new TcpListener(IPAddress.Loopback,0);
        reservation.Start(); var port = ((IPEndPoint)reservation.LocalEndpoint).Port;
        Endpoint = new Uri($"http://127.0.0.1:{port}/mcp");
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { ApplicationName = typeof(FixtureHost).Assembly.GetName().Name });
        builder.WebHost.UseUrls($"http://127.0.0.1:{port}", "http://127.0.0.1:0");
        builder.AddCratisArc(options => {
            options.EndpointGroups.Assign("capabilities",port);
            options.Tenancy.ResolverType = TenantResolverType.Fixed;
            options.Tenancy.FixedTenantId = "tenant-a";
        }, configureBuilder: arc => arc.WithCapabilities()
            .WithPersonalAccessTokens(new("direct") { AllowedScopes = ["catalog:read","catalog:write"] }, callers => callers.ForResource("resource","audience","test").UsePersonDirectory<FixturePeople>())
            .WithMcp(mcp => mcp.Configure(options => { options.ApplicationName = "catalog"; options.Profile = McpProfile.PatOnly; })));
        Reader = AddCredential("catalog:read"); Other = AddCredential("catalog:write");
        var authority = Substitute.For<IPatAuthority>();
        authority.ReadAuthoritative(Arg.Any<string>(),Arg.Any<string>(),Arg.Any<CancellationToken>()).Returns(call => records.GetValueOrDefault(call.ArgAt<string>(1)));
        var epochs = Substitute.For<IPatRecoveryEpoch>(); epochs.Read(Arg.Any<CancellationToken>()).Returns(1UL);
        var policy = Substitute.For<IPatPolicy>();
        policy.Evaluate(Arg.Any<PatRecord>(),Arg.Any<bool>(),Arg.Any<CancellationToken>()).Returns(new PatPolicyDecision(true,TimeSpan.FromMinutes(10),1));
        builder.Services.AddSingleton(authority); builder.Services.AddSingleton(epochs); builder.Services.AddSingleton(policy);
        var collection = Substitute.For<IMongoCollection<Author>>();
        var cursor = Substitute.For<IAsyncCursor<Author>>();
        cursor.Current.Returns(new[] { new Author(Catalog.Authors.AuthorId.New(), "Aster") });
        cursor.MoveNext(Arg.Any<CancellationToken>()).Returns(true, false);
        collection.FindSync(Arg.Any<FilterDefinition<Author>>(), Arg.Any<FindOptions<Author, Author>>(), Arg.Any<CancellationToken>()).Returns(cursor);
        builder.Services.AddSingleton(collection);
        app = builder.Build(); app.UseCratisArc(); app.MapArcMcp();
    }
    public Task Start(CancellationToken token) => app.StartAsync(token);
    public ValueTask DisposeAsync() => app.DisposeAsync();

    // Only the isolated authority knows these short-lived, randomly generated fixture records.
    string AddCredential(string scope)
    {
        string Hash(string text) => Convert.ToHexString(SHA256.HashData(Encoding.ASCII.GetBytes(text)));
        var body = "direct_pat_v1_" + Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        var token = body + "_" + Hash(body)[..8].ToLowerInvariant();
        var digest = Hash("cratis-arc-pat-verifier-v1\0" + token);
        var now = DateTimeOffset.UtcNow;
        records.Add(digest,new PatRecord(new(Guid.NewGuid().ToString()),digest,"direct","resource","audience","test",new("person"),new("https://identity.example","62a07b13-0838-477d-9f43-1aa3d2911104"),new("tenant-a"),null,new HashSet<string>{scope},now.AddMinutes(-1),now.AddMinutes(10),new("https://identity.example",now.AddMinutes(-2).ToUnixTimeSeconds(),null,["sso"]),1,1));
        return token;
    }
}

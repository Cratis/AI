using Cratis.Arc;
using Cratis.Arc.Identity.Callers;
using Cratis.Arc.Mcp;
using Cratis.Arc.PersonalAccessTokens;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using System.Net;
using System.Net.Sockets;
using Xunit;

namespace Library.Identity;

public class LibraryPersonDirectory : ICallerPersonDirectory
{
    // This startup-only host has no persisted person records.
    public Task<CallerPersonFound> Find(CallerAccountKey accountKey, CancellationToken cancellationToken) =>
        Task.FromResult(CallerPersonFound.NotFound());
}

public class CapabilityStartup
{
    [Fact] public async Task starts_with_a_bound_capability_listener_and_a_real_pat_installation()
    {
        using var reservation = new TcpListener(IPAddress.Loopback, 0);
        reservation.Start();
        var port = ((IPEndPoint)reservation.LocalEndpoint).Port;
        reservation.Stop();
        var builder = WebApplication.CreateBuilder();
        builder.WebHost.UseUrls($"http://127.0.0.1:{port}");
        builder.AddCratisArc(options => options.EndpointGroups.Assign("capabilities", port),
            configureBuilder: arc => arc
            .WithPersonalAccessTokens(new PatOptions("direct") { AllowedScopes = ["catalog:read", "catalog:write"] },
                callers => callers.ForResource("urn:catalog", "catalog-mcp", "development").UsePersonDirectory<LibraryPersonDirectory>())
            .WithCapabilities()
            .WithMcp(mcp => mcp.Configure(options => options.ApplicationName = "catalog")));
        await using var app = builder.Build();
        app.UseCratisArc();
        app.MapArcMcp();
        await app.StartAsync(TestContext.Current.CancellationToken);
        await app.StopAsync(TestContext.Current.CancellationToken);
    }
}

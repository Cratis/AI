using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Probe.Authors;
using Xunit;

public class Host
{
    [Fact] public async Task discovered_snapshot_returns_seeded_row()
    {
        await using var app = ProbeHost.Create();
        app.Services.GetRequiredService<Rows>().Register();
        await app.StartAsync(TestContext.Current.CancellationToken);
        using var client = new HttpClient { BaseAddress = new Uri(app.Urls.Single()) };
        using var json = JsonDocument.Parse(await client.GetStringAsync("/api/authors/snapshot", TestContext.Current.CancellationToken));
        Assert.Equal("Aster", json.RootElement.GetProperty("data")[0].GetProperty("name").GetString());
    }
}

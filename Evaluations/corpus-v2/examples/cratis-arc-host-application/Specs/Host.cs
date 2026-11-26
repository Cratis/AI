using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Library.Features.Authors.Listing;
using Xunit;

public class Host
{
    [Fact] public async Task discovered_snapshot_returns_seeded_row()
    {
        await using var app = ProbeHost.Create();
        app.Services.GetRequiredService<Rows>().Register();
        await app.StartAsync(TestContext.Current.CancellationToken);
        using var client = new HttpClient { BaseAddress = new Uri(app.Urls.Single()) };
        using var json = JsonDocument.Parse(await client.GetStringAsync("/api/features/authors/listing/all-authors?waitForFirstResult=true", TestContext.Current.CancellationToken));
        Assert.True(json.RootElement.GetProperty("isSuccess").GetBoolean());
        var author = Assert.Single(json.RootElement.GetProperty("data").EnumerateArray());
        Assert.Equal("Aster", author.GetProperty("name").GetString());
    }
}

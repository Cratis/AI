using System.Net.Http.Headers;
using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Probe.Authors;
using Xunit;

public class Stream
{
    [Fact] public async Task serves_initial_rows_and_subsequent_registration()
    {
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(TestContext.Current.CancellationToken);
        deadline.CancelAfter(TimeSpan.FromSeconds(15));
        await using var app = ProbeHost.Create(); await app.StartAsync(deadline.Token);
        using var client = new HttpClient { BaseAddress = new Uri(app.Urls.Single()) };
        client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("text/event-stream"));
        using var response = await client.GetAsync("/api/authors/all-authors", HttpCompletionOption.ResponseHeadersRead, deadline.Token);
        response.EnsureSuccessStatusCode();
        using var reader = new StreamReader(await response.Content.ReadAsStreamAsync(deadline.Token));
        async Task<JsonElement> Next()
        {
            while (await reader.ReadLineAsync(deadline.Token) is { } line)
            {
                if (!line.StartsWith("data:", StringComparison.Ordinal)) continue;
                using var frame = JsonDocument.Parse(line[5..]);
                Assert.True(frame.RootElement.GetProperty("isSuccess").GetBoolean());
                return frame.RootElement.GetProperty("data").Clone();
            }
            throw new EndOfStreamException();
        }
        var initialAuthors = await Next();
        Assert.Empty(initialAuthors.EnumerateArray());
        app.Services.GetRequiredService<Rows>().Register();
        var row = Assert.Single((await Next()).EnumerateArray());
        Assert.Equal("11111111-1111-4111-8111-111111111111", row.GetProperty("id").GetString());
        Assert.Equal("Aster", row.GetProperty("name").GetString());
    }
}

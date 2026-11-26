using Cratis.Arc.Mcp;
using Cratis.Arc.Queries.ModelBound;
using MongoDB.Driver;
using Xunit;

[Cratis.Arc.Commands.ModelBound.Command]
[ExposeOverMcp("register_author", Description = "Registers an author in the library.")]
public record RegisterAuthor(Catalog.Authors.AuthorId Id, string Name)
{
    public Catalog.Authors.AuthorRegistered Handle() => new(Name);
}

[ReadModel]
[Cratis.Chronicle.Projections.ModelBound.FromEvent<Catalog.Authors.AuthorRegistered>]
public record Author(Catalog.Authors.AuthorId Id, string Name)
{
    [ExposeOverMcp("list_authors", Description = "Lists the library's authors.")]
    public static IEnumerable<Author> ListAuthors(IMongoCollection<Author> collection) =>
        collection.Find(_ => true).ToList();
}

// Exercise the catalog and dispatch over HTTP, not by inspecting attributes.
public class Exposure
{
    [Fact] public async Task scoped_tool_listing_matches_execution()
    {
        await using var fixture = new FixtureHost();
        await fixture.Start(TestContext.Current.CancellationToken);
        using var http = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false }) { BaseAddress = fixture.Endpoint, Timeout = TimeSpan.FromSeconds(10) };
        Assert.True(http.BaseAddress.IsLoopback);
        async Task<(bool Ok,string Body)> Rpc(string method, object args, string? token)
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, http.BaseAddress) { Content = System.Net.Http.Json.JsonContent.Create(new { jsonrpc = "2.0", id = 1, method, @params = args }) };
            if (token != null) request.Headers.Authorization = new("Bearer",token);
            request.Headers.Accept.ParseAdd("application/json, text/event-stream");
            using var response = await http.SendAsync(request, TestContext.Current.CancellationToken);
            return (response.IsSuccessStatusCode, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        }
        var read = fixture.Reader; var insufficient = fixture.Other;
        var listed = await Rpc("tools/list",new {},read);
        Assert.True(listed.Ok && listed.Body.Contains("list_authors",StringComparison.Ordinal) && !listed.Body.Contains("register_author",StringComparison.Ordinal));
        var writerTools = await Rpc("tools/list",new {},insufficient);
        Assert.True(writerTools.Ok && writerTools.Body.Contains("register_author",StringComparison.Ordinal) && !writerTools.Body.Contains("list_authors",StringComparison.Ordinal));
        var args = new {name = "list_authors", arguments = new {}};
        var valid = await Rpc("tools/call",args,read); Assert.True(valid.Ok && valid.Body.Contains("Aster",StringComparison.Ordinal));
        foreach (var token in new string?[]{null,insufficient})
        {
            var denied = await Rpc("tools/call",args,token); Assert.False(denied.Body.Contains("Aster",StringComparison.Ordinal));
            Assert.True(!denied.Ok || denied.Body.Contains("error",StringComparison.OrdinalIgnoreCase));
        }
        var hidden = await Rpc("tools/call",new {name="unlisted_lookup",arguments=new {}},read);
        Assert.True(!hidden.Ok || hidden.Body.Contains("error",StringComparison.OrdinalIgnoreCase));
    }
}

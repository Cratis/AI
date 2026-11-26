using Cratis.Chronicle;
using Cratis.Chronicle.Events;
using Xunit;
using Microsoft.AspNetCore.Builder;

using Library.Features.Authors;

namespace Library.Features.Authors.Registration;

public class ConnectionProbe
{
    public static async Task RunAuthorsHost(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args)
            .AddCratisChronicle(options => options.EventStore = "library");

        var app = builder.Build();
        app.UseCratisChronicle();
        await app.RunAsync();
    }

    [Fact]
    public async Task one_client_selects_two_independent_namespaces()
    {
        using var client = new ChronicleClient(ChronicleOptions.FromDevelopmentConnectionString());
        const string name = "library";
        var ns = Guid.NewGuid().ToString();
        var expected = await client.GetEventStore(name, ns);
        var control = await client.GetEventStore(name, ns + "-other");
        var id = new AuthorId(Guid.NewGuid());
        Assert.Equal(name, expected.Name.Value);
        Assert.Equal(ns, expected.Namespace.Value);
        Assert.True((await expected.EventLog.Append(id, new AuthorRegistered("Aster"))).IsSuccess);
        Assert.Equal(new AuthorRegistered("Aster"), Assert.Single(await expected.EventLog.GetFromSequenceNumber(EventSequenceNumber.First, id)).Content);
        Assert.Empty(await control.EventLog.GetFromSequenceNumber(EventSequenceNumber.First, id));
    }
}

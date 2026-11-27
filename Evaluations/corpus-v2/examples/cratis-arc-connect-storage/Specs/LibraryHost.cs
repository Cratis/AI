using Cratis.Arc.MongoDB;
using Microsoft.AspNetCore.Builder;
using Cratis.Chronicle;

namespace Library.Storage;

public class LibraryHost
{
    public static async Task Start(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);
        builder.AddCratis(
            configureArcBuilder: arc => arc.WithMongoDB(configureMongoDB: mongo => mongo.WithCamelCaseNamingPolicy()),
            configureChronicleBuilder: chronicle => chronicle.WithCamelCaseNamingPolicy());
        var app = builder.Build();
        app.UseWebSockets();
        app.UseCratis();
        await app.RunAsync();
    }
}

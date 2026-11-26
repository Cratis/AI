using Cratis.Arc;
using Probe.Authors;

await using var app = ProbeHost.Create();
await app.StartAsync();
Console.WriteLine($"READY {app.Urls.Single()}");
while (await Console.In.ReadLineAsync() is { } command)
{
    if (command == "quit") break;
    if (command == "register") app.Services.GetRequiredService<Rows>().Register();
}
await app.StopAsync();

public static class ProbeHost
{
    public static WebApplication Create()
    {
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { ApplicationName = typeof(ProbeHost).Assembly.GetName().Name });
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Services.AddSingleton<Rows>();
        builder.AddCratisArc(options => { options.GeneratedApis.RoutePrefix = "api"; options.GeneratedApis.SegmentsToSkipForRoute = 1; }, configureBuilder: arc => arc.WithoutControllers());
        var app = builder.Build();
        app.UseCratisArc();
        app.MapGet("/", () => Results.Content("<main>Waiting</main>", "text/html"));
        return app;
    }
}

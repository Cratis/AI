using Microsoft.AspNetCore.Builder;

namespace Probe;

public static class MinimalHost
{
    public static async Task Start(string[] args)
    {
        #region docs:host
        var builder = WebApplication.CreateBuilder(args);
        builder.AddCratisArc();
        var app = builder.Build();
        app.UseCratisArc();
        await app.RunAsync();
        #endregion docs:host
    }
}

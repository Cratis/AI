using Microsoft.AspNetCore.Builder;

namespace Catalog;

public static class MinimalHost
{
    public static async Task Start(string[] args)
    {
        #region docs:host
        var builder = WebApplication.CreateBuilder(args);
        builder.AddCratisArc(options =>
        {
            options.GeneratedApis.RoutePrefix = "api";
            options.GeneratedApis.SegmentsToSkipForRoute = 1;
        });
        var app = builder.Build();
        app.UseCratisArc();
        await app.RunAsync();
        #endregion docs:host
    }
}

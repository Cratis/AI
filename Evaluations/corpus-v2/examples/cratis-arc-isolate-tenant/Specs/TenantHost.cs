using Library.Tenancy;
using Cratis.Arc.Tenancy;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;

namespace Library;

public class TenantHost
{
    public static async Task Start(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);
        builder.AddCratisArc(options => options.UseClaimTenancy("tenant_id"));
        builder.Services.AddScoped<ITenantMembership, ClaimsTenantMembership>();
        var app = builder.Build();
        app.UseCratisArc();
        await app.RunAsync();
    }
}

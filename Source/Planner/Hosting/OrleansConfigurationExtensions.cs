// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Orleans.Configuration;
using Orleans.Providers.MongoDB.Configuration;

namespace Planner.Hosting;

/// <summary>
/// Extension methods for co-hosting the Planner's Orleans silo.
/// </summary>
/// <remarks>
/// The Planner co-hosts a single silo in-process. Locally the silo uses localhost clustering with
/// in-memory reminders; set <c>Orleans:Clustering</c> to <c>MongoDB</c> for durable clustering and
/// reminders when running more than one instance - typically in Kubernetes.
/// </remarks>
public static class OrleansConfigurationExtensions
{
    /// <summary>
    /// The MongoDB database holding the Orleans clustering and reminder tables.
    /// </summary>
    public const string OrleansDatabaseName = "planner-orleans";

    /// <summary>
    /// Adds the co-hosted Orleans silo, unless disabled through <c>Orleans:Enabled</c>.
    /// </summary>
    /// <param name="builder">The <see cref="WebApplicationBuilder"/> to configure.</param>
    /// <returns>The same <see cref="WebApplicationBuilder"/> for chaining.</returns>
    public static WebApplicationBuilder AddPlannerOrleans(this WebApplicationBuilder builder)
    {
        if (!builder.Configuration.GetValue("Orleans:Enabled", true))
        {
            return builder;
        }

        var useMongoClustering = builder.Configuration["Orleans:Clustering"] == "MongoDB";
        builder.Host.UseOrleans(silo =>
        {
            silo.Configure<ClusterOptions>(options =>
            {
                options.ClusterId = "planner";
                options.ServiceId = "planner";
            });

            if (useMongoClustering)
            {
                var connectionString = builder.Configuration["Cratis:MongoDB:Server"] ?? "mongodb://localhost:27017";
                silo.UseMongoDBClient(connectionString);
                silo.UseMongoDBClustering(options =>
                {
                    options.DatabaseName = OrleansDatabaseName;
                    options.Strategy = MongoDBMembershipStrategy.SingleDocument;
                });
                silo.UseMongoDBReminders(options => options.DatabaseName = OrleansDatabaseName);
            }
            else
            {
                silo.UseLocalhostClustering();
                silo.UseInMemoryReminderService();
            }
        });

        return builder;
    }
}

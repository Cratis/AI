// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Orleans.Configuration;
using Orleans.Providers.MongoDB.Configuration;
using Orleans.Serialization.Configuration;

namespace Planner.Hosting;

/// <summary>
/// Extension methods for co-hosting the Planner's Orleans silo.
/// </summary>
/// <remarks>
/// The Planner co-hosts a single silo in-process. Locally the silo uses localhost clustering with
/// in-memory reminders; set <c>Planner:Orleans:Clustering</c> to <c>MongoDB</c> for durable
/// clustering and reminders when running more than one instance - typically in Kubernetes.
/// </remarks>
public static class OrleansConfigurationExtensions
{
    /// <summary>
    /// The MongoDB database holding the Orleans clustering and reminder tables.
    /// </summary>
    public const string OrleansDatabaseName = "planner-orleans";

    /// <summary>
    /// Adds the co-hosted Orleans silo, unless disabled through <c>Planner:Orleans:Enabled</c>.
    /// </summary>
    /// <param name="builder">The <see cref="WebApplicationBuilder"/> to configure.</param>
    /// <returns>The same <see cref="WebApplicationBuilder"/> for chaining.</returns>
    public static WebApplicationBuilder AddPlannerOrleans(this WebApplicationBuilder builder)
    {
        var options = OrleansOptions.From(builder.Configuration);
        if (!options.Enabled)
        {
            return builder;
        }

        builder.Host.UseOrleans(silo =>
        {
            silo.Configure<ClusterOptions>(options =>
            {
                options.ClusterId = "planner";
                options.ServiceId = "planner";
            });

            // The Chronicle client assemblies expose serializable types Orleans' configuration
            // analyzer cannot build codecs for. None of them ever cross a grain boundary here -
            // the Planner's grain methods use primitives only - so skip the analysis instead of
            // failing startup on types this silo never serializes.
            silo.Services.Configure<TypeManifestOptions>(options => options.EnableConfigurationAnalysis = false);

            if (options.Clustering == ClusteringMode.MongoDB)
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

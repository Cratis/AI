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
/// The Planner co-hosts a single silo in-process. Locally the silo uses localhost clustering; set
/// <c>Planner:Orleans:Clustering</c> to <c>MongoDB</c> for durable cluster membership when running
/// more than one instance - typically in Kubernetes. Reminders always come from Orleans' own
/// in-memory reminder service, in both modes - see <see cref="AddPlannerOrleans"/>.
/// </remarks>
public static class OrleansConfigurationExtensions
{
    /// <summary>
    /// The MongoDB database holding the Orleans cluster membership table.
    /// </summary>
    public const string OrleansDatabaseName = "planner-orleans";

    /// <summary>
    /// Adds the co-hosted Orleans silo, unless disabled through <c>Planner:Orleans:Enabled</c>.
    /// </summary>
    /// <param name="builder">The <see cref="WebApplicationBuilder"/> to configure.</param>
    /// <returns>The same <see cref="WebApplicationBuilder"/> for chaining.</returns>
    /// <remarks>
    /// <para>
    /// <c>Orleans.Providers.MongoDB</c> has no Orleans 10 release - 9.5.0 is a 9.x binary - so only the
    /// parts of it that Cratis Studio proves safe on the 10.x runtime are used here: cluster membership,
    /// and nothing else. Studio runs the exact same package pair in production with MongoDB clustering
    /// across several co-hosted silos and never touches the 9.x reminder table.
    /// </para>
    /// <para>
    /// The reminder table is where that version skew bites. Pointing the 10.x <c>LocalReminderService</c>
    /// at the 9.x <c>MongoReminderTable</c> makes the reminder service stop responding: the first
    /// <c>RegisterOrUpdateReminder</c> never completes, the calling grain's request times out, the
    /// reminder row is never written, and neither recurring grain ever ticks. Orleans' own in-memory
    /// reminder service is 10.x end to end and works in both modes, so it is used unconditionally.
    /// Reminders then do not survive a full cluster restart - which costs nothing here, because
    /// <see cref="PlannerGrainsActivator"/> re-registers both of them on every start.
    /// </para>
    /// </remarks>
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
            }
            else
            {
                silo.UseLocalhostClustering();
            }

            // Never the 9.x MongoDB reminder table on the 10.x runtime - it hangs the reminder
            // service outright (see the remarks on this method). This keeps every reminder code
            // path on 10.x, which leaves cluster membership as the only thing the 9.x provider
            // does - exactly the arrangement Studio runs in production.
            silo.UseInMemoryReminderService();
        });

        return builder;
    }
}

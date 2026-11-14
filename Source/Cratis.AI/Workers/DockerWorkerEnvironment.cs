// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers;

/// <summary>
/// Builds worker environment variables while omitting mode-specific repository inputs.
/// </summary>
/// <param name="job">The requested worker job.</param>
/// <param name="cachePath">The applied repository cache path, or null.</param>
/// <param name="cacheVariable">The cache environment variable name.</param>
/// <param name="hostPrepared">Whether the host prepared the workspace.</param>
internal sealed class DockerWorkerEnvironment(WorkerJob job, string? cachePath, string? cacheVariable, bool hostPrepared)
{
    /// <summary>Builds the filtered environment.</summary>
    /// <returns>The non-secret runtime environment.</returns>
    internal List<string> Build() =>
    [
        .. job.EnvironmentVariables.Where(variable => Include(variable.Key)).Select(variable => $"{variable.Key}={variable.Value}"),
        $"{WorkerSecrets.PathVariableName}={WorkerSecrets.Path}",
        $"{WorkerPromptFile.PathVariableName}={WorkerPromptFile.Path}",
        .. hostPrepared ? (string[])[$"{HostWorkspace.ModeVariable}={HostWorkspace.ModeValue}", $"{HostWorkspace.ContainerPathVariable}={HostWorkspace.ContainerPath}"] : [],
        .. CacheEnvironment()
    ];

    IEnumerable<string> CacheEnvironment()
    {
        var plan = WorkerCacheMounts.Create(job.Cache);
        return plan.AppliesTo(job, cachePath, hostPrepared)
            ? plan.Environment(cachePath!, cacheVariable).Select(pair => $"{pair.Key}={pair.Value}")
            : [];
    }

    bool Include(string name)
    {
        if (name == WorkerPromptFile.LegacyVariableName || WorkerCacheMounts.IsEnvironmentVariable(name, cacheVariable)) return false;
        return !hostPrepared || name is not (HostWorkspace.ModeVariable or HostWorkspace.ContainerPathVariable or HostWorkspace.HostPathVariable);
    }
}

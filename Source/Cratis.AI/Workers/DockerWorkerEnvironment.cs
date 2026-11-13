// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers;

/// <summary>
/// Builds worker environment variables while omitting mode-specific repository inputs.
/// </summary>
/// <param name="job">The requested worker job.</param>
/// <param name="cachePath">The optional repository cache path.</param>
/// <param name="cacheVariable">The cache environment variable name.</param>
/// <param name="hostPrepared">Whether the host prepared the workspace.</param>
internal sealed class DockerWorkerEnvironment(WorkerJob job, string? cachePath, string? cacheVariable, bool hostPrepared)
{
    readonly bool _restricted = job.EnvironmentVariables.ContainsKey("DIRECT_REPOSITORY_CHECKOUTS");

    /// <summary>
    /// Renders the filtered job variables and runtime-owned paths.
    /// </summary>
    /// <returns>The container environment.</returns>
    internal List<string> Build()
    {
        return
        [
            .. job.EnvironmentVariables
                .Where(variable => Include(variable.Key))
                .Select(variable => $"{variable.Key}={variable.Value}"),
            $"{WorkerSecrets.PathVariableName}={WorkerSecrets.Path}",
            $"{WorkerPromptFile.PathVariableName}={WorkerPromptFile.Path}",
            .. hostPrepared ? (string[])[$"{HostWorkspace.ModeVariable}={HostWorkspace.ModeValue}", $"{HostWorkspace.ContainerPathVariable}={HostWorkspace.ContainerPath}"] : [],
            .. IncludeCache() ? (string[])[$"{cacheVariable}={cachePath}"] : []
        ];
    }

    bool Include(string name)
    {
        if (name == WorkerPromptFile.LegacyVariableName)
        {
            return false;
        }
        if (SuppressCache() && IsCacheVariable(name))
        {
            return false;
        }
        return !hostPrepared || name is not (HostWorkspace.ModeVariable or HostWorkspace.ContainerPathVariable or HostWorkspace.HostPathVariable);
    }

    bool IncludeCache() => !SuppressCache() && CacheIsConfigured();

    bool CacheIsConfigured() => !string.IsNullOrWhiteSpace(cachePath) && !string.IsNullOrWhiteSpace(cacheVariable);

    bool SuppressCache() => _restricted || hostPrepared;

    bool IsCacheVariable(string name) => name == cacheVariable || name == "DIRECT_REPOSITORY_CACHE";
}

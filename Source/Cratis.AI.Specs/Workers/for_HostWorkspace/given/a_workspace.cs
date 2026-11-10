// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.AI.Usage;

namespace Cratis.AI.Workers.for_HostWorkspace.given;

public class a_workspace : Specification
{
    protected string _root;
    protected string _workspace;
    protected WorkerJob _job;

    void Establish()
    {
        var temporary = Directory.CreateTempSubdirectory();
        var current = Path.GetPathRoot(temporary.FullName)!;
        foreach (var segment in temporary.FullName[current.Length..].Split(Path.DirectorySeparatorChar))
        {
            var directory = new DirectoryInfo(Path.Combine(current, segment));
            current = directory.ResolveLinkTarget(true)?.FullName ?? directory.FullName;
        }
        _root = current;
        _workspace = Directory.CreateDirectory(Path.Combine(_root, "workspace")).FullName;
        Directory.CreateDirectory(Path.Combine(_workspace, ".git"));
        _job = new(
            AgentSessionId.New(),
            "worker:latest",
            new Dictionary<string, string>
            {
                [HostWorkspace.ModeVariable] = HostWorkspace.ModeValue,
                [HostWorkspace.HostPathVariable] = _workspace
            },
            new Dictionary<string, string>());
    }

    protected WorkerJob WithPath(string path) => _job with
    {
        EnvironmentVariables = new Dictionary<string, string>(_job.EnvironmentVariables) { [HostWorkspace.HostPathVariable] = path }
    };

    void Destroy() => Directory.Delete(_root, true);
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Diagnostics;

namespace Cratis.AI.Workers.for_KubernetesWorkerCacheVerification.given;

public class cache_directories : Specification
{
    protected const string Memory = ".agent-memory/v1-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    protected const string Repository = "owner/group/allowed.git";
    protected DirectoryInfo _root;

    void Establish()
    {
        _root = Directory.CreateTempSubdirectory("cache-verification-");
        Directory.CreateDirectory(Path.Combine(_root.FullName, Memory));
        Directory.CreateDirectory(Path.Combine(_root.FullName, Repository));
        Directory.CreateDirectory(Path.Combine(_root.FullName, "allowed.git"));
    }

    protected int Verify(params string[] paths)
    {
        var start = new ProcessStartInfo("/bin/sh") { RedirectStandardOutput = true, RedirectStandardError = true, UseShellExecute = false };
        foreach (var argument in new[] { "-eu", "-c", KubernetesWorkerCacheVerification.Script, "fixture", _root.FullName }.Concat(paths))
        {
            start.ArgumentList.Add(argument);
        }
        using var process = Process.Start(start)!;
        process.StandardOutput.ReadToEnd();
        process.StandardError.ReadToEnd();
        process.WaitForExit();
        return process.ExitCode;
    }

    void Destroy() => _root.Delete(recursive: true);
}

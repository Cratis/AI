// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_DockerWorkerRuntime.given;

public class a_delivered_entrypoint_gate : an_entrypoint_gate
{
    protected string _markerAttributes = "0:444";
    string _directory;

    void Establish()
    {
        _directory = Path.Combine(Path.GetTempPath(), $"worker-gate-{Guid.NewGuid():N}");
        _readyDirectory = Path.Combine(_directory, "ready");
        _file = Path.Combine(_directory, "credentials");
        Directory.CreateDirectory(_readyDirectory);
        File.WriteAllText(_file, ":\n");
        File.WriteAllText(Path.Combine(_readyDirectory, WorkerSecrets.ReadyFileName), "ready\n");
    }

    protected Task RunDeliveredGate()
    {
        // Substitute ownership/filesystem responses only; real Docker must prove those attributes.
        // The actual directory is non-writable to exercise the entrypoint's -w check as a non-root user.
        _preamble = string.Join('\n',
            $"chmod 0555 '{_readyDirectory}'",
            "stat() {",
            "case \"$*\" in",
            "'-f -c %T '*) printf 'tmpfs' ;;",
            $"'-c %u:%a {_file}') printf '%s:400' \"$(id -u)\" ;;",
            $"'-c %u:%a {_directory}') printf '%s:700' \"$(id -u)\" ;;",
            $"'-c %u:%a {_readyDirectory}') printf '0:755' ;;",
            $"*) printf '%s' '{_markerAttributes}' ;;",
            "esac",
            "}");
        return RunGate();
    }

    void Destroy()
    {
        if (!OperatingSystem.IsWindows())
        {
            File.SetUnixFileMode(_readyDirectory, UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);
        }
        Directory.Delete(_directory, recursive: true);
    }
}

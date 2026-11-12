// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers;

/// <summary>
/// A Docker worker could not be started with secure credential delivery. Engine diagnostics are
/// deliberately withheld because they may contain credentials.
/// </summary>
/// <param name="cleanupFailed">Whether removing the failed container also failed.</param>
public class DockerWorkerLaunchFailed(bool cleanupFailed = false)
    : Exception(cleanupFailed
        ? "Docker worker launch failed; container cleanup could not be confirmed."
        : "Docker worker launch failed; the container was removed.");

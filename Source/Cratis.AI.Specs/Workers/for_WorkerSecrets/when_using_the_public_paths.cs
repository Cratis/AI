// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Workers.for_WorkerSecrets;

public class when_using_the_public_paths : Specification
{
    [Fact] void should_keep_credentials_in_the_private_directory() => WorkerSecrets.Path.ShouldEqual($"{WorkerSecrets.Directory}/{WorkerSecrets.FileName}");
    [Fact] void should_keep_the_ready_marker_in_the_same_mount() => WorkerSecrets.ReadyPath.ShouldEqual($"{WorkerSecrets.Directory}/{WorkerSecrets.ReadyFileName}");
    [Fact] void should_stage_the_marker_on_the_same_mount() => WorkerSecrets.PendingReadyPath.ShouldEqual($"{WorkerSecrets.Directory}/{WorkerSecrets.PendingReadyFileName}");
    [Fact] void should_not_expose_a_pending_marker_as_readiness() => WorkerSecrets.PendingReadyPath.ShouldNotEqual(WorkerSecrets.ReadyPath);
    [Fact] void should_match_the_entrypoint_credentials_contract() => WorkerSecrets.PathVariableName.ShouldEqual("DIRECT_SECRETS_FILE");
    [Fact] void should_match_the_entrypoint_marker_contract() => WorkerSecrets.ReadyFileName.ShouldEqual("secrets.ready");
}

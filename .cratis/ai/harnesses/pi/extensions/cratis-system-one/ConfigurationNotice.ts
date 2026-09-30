// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/**
 * The kind of a configuration notice. Each kind is announced once per session under its own class, so
 * one notice never hides a different one that comes later.
 */
export enum ConfigurationNotice {
    ReadableByOthers = 'configuration-readable-by-others',
    PredatesVersion = 'configuration-predates-version',
    OriginMismatch = 'configuration-origin-mismatch',
    RepositoryProblem = 'configuration-repository-problem',
    UserFileInvalid = 'configuration-user-file-invalid',
    UserFileUnreadable = 'configuration-user-file-unreadable',
    EndpointRefused = 'configuration-endpoint-refused',
    ModelInvalid = 'configuration-model-invalid',
}

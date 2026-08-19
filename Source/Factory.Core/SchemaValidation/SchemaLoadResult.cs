// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.SchemaValidation;

/// <summary>
/// Represents a deterministic schema resource-set loading outcome.
/// </summary>
/// <param name="Status">The stable loading status.</param>
/// <param name="ResourceSet">The immutable resource set when loading succeeds.</param>
/// <param name="Diagnostics">The stable ordered diagnostics.</param>
public sealed record SchemaLoadResult(
    SchemaLoadStatus Status,
    SchemaResourceSet? ResourceSet,
    IReadOnlyList<SchemaDiagnostic> Diagnostics);

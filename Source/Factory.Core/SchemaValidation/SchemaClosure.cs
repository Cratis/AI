// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.Hashing;

namespace Cratis.Factory.SchemaValidation;

/// <summary>
/// Describes the deterministic transitive schema closure for one selected root resource.
/// </summary>
/// <param name="RootSchemaId">The selected top-level or embedded root resource identifier.</param>
/// <param name="Identity">The canonical closure identity.</param>
/// <param name="Members">The ordered top-level document membership.</param>
/// <param name="ResourceCount">The number of reachable top-level and embedded resources.</param>
/// <param name="AnchorCount">The number of anchors owned by reachable resources.</param>
/// <param name="ReferenceCount">The number of reference edges originating in reachable resources.</param>
public sealed record SchemaClosure(
    string RootSchemaId,
    Sha256Hash Identity,
    IReadOnlyList<SchemaClosureMember> Members,
    int ResourceCount,
    int AnchorCount,
    int ReferenceCount);

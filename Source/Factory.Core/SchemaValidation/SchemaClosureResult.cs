// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.Hashing;

namespace Cratis.Factory.SchemaValidation;

/// <summary>
/// Represents deterministic selection of one root's immutable schema closure.
/// </summary>
/// <param name="Status">The stable selection status.</param>
/// <param name="SchemaId">The requested schema identifier, or an empty value when it was unsafe or invalid.</param>
/// <param name="SchemaSetIdentity">The immutable resource-set identity.</param>
/// <param name="Closure">The selected closure when resolution succeeds.</param>
/// <param name="Diagnostics">The stable ordered diagnostics.</param>
public sealed record SchemaClosureResult(
    SchemaClosureStatus Status,
    string SchemaId,
    Sha256Hash SchemaSetIdentity,
    SchemaClosure? Closure,
    IReadOnlyList<SchemaDiagnostic> Diagnostics);

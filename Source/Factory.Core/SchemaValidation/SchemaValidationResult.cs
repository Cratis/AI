// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Factory.Hashing;

namespace Cratis.Factory.SchemaValidation;

/// <summary>
/// Represents one bounded deterministic instance-validation outcome.
/// </summary>
/// <param name="Status">The stable validation status.</param>
/// <param name="SchemaId">The requested root schema identifier.</param>
/// <param name="SchemaSetIdentity">The immutable resource-set identity.</param>
/// <param name="Closure">The selected root closure when the root exists.</param>
/// <param name="Diagnostics">The stable ordered diagnostics.</param>
public sealed record SchemaValidationResult(
    SchemaValidationStatus Status,
    string SchemaId,
    Sha256Hash SchemaSetIdentity,
    SchemaClosure? Closure,
    IReadOnlyList<SchemaDiagnostic> Diagnostics);

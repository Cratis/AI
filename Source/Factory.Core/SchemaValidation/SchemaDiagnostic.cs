// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.SchemaValidation;

/// <summary>
/// Describes one stable, bounded schema diagnostic without raw input or package prose.
/// </summary>
/// <param name="Code">The stable diagnostic code.</param>
/// <param name="Severity">The stable diagnostic severity.</param>
/// <param name="Status">The stable diagnostic contribution to the operation outcome.</param>
/// <param name="SchemaId">The affected admitted schema identifier, or <see langword="null"/> when none is safe to report.</param>
/// <param name="InstanceLocation">The privacy-preserving structural instance location.</param>
/// <param name="KeywordLocation">The privacy-preserving structural schema-keyword location.</param>
public sealed record SchemaDiagnostic(
    SchemaDiagnosticCode Code,
    SchemaDiagnosticSeverity Severity,
    SchemaDiagnosticStatus Status,
    string? SchemaId,
    string InstanceLocation,
    string KeywordLocation);

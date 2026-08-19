// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.SchemaValidation;

/// <summary>
/// Defines the inclusive resource limits for one immutable schema resource set and its validations.
/// </summary>
public static class SchemaValidationLimits
{
    /// <summary>
    /// The maximum number of caller-supplied schema documents.
    /// </summary>
    public const int MaximumDocuments = 64;

    /// <summary>
    /// The maximum aggregate number of caller-supplied schema bytes.
    /// </summary>
    public const int MaximumAggregateSchemaBytes = 8_000_000;

    /// <summary>
    /// The maximum number of top-level and embedded schema resources.
    /// </summary>
    public const int MaximumResources = 256;

    /// <summary>
    /// The maximum number of anchors across the resource set.
    /// </summary>
    public const int MaximumAnchors = 1_024;

    /// <summary>
    /// The maximum number of reference edges across the resource set.
    /// </summary>
    public const int MaximumReferenceEdges = 512;

    /// <summary>
    /// The maximum number of consecutive references that can be followed without consuming an instance location.
    /// </summary>
    public const int MaximumReferenceDepth = 64;

    /// <summary>
    /// The maximum number of Draft schema positions across one resource set.
    /// </summary>
    public const int MaximumSchemaNodes = 16_384;

    /// <summary>
    /// The maximum number of JSON values admitted for one validation.
    /// </summary>
    public const int MaximumInstanceNodes = 65_536;

    /// <summary>
    /// The maximum weighted actual-instance/schema-position work admitted for one validation verdict.
    /// </summary>
    public const int MaximumEvaluationWorkUnits = 32_767;

    /// <summary>
    /// The maximum number of JSON values for which rich hierarchical diagnostics are materialized.
    /// </summary>
    public const int MaximumDiagnosticInstanceNodes = 4_096;

    /// <summary>
    /// The maximum weighted actual-instance/schema-position work for which rich hierarchical diagnostics are materialized.
    /// </summary>
    public const int MaximumDiagnosticWorkUnits = 4_095;

    /// <summary>
    /// The maximum number of diagnostics returned by one operation.
    /// </summary>
    public const int MaximumDiagnostics = 256;

    /// <summary>
    /// The maximum number of Unicode scalar values in one regular expression.
    /// </summary>
    public const int MaximumPatternScalars = 2_048;

    /// <summary>
    /// The maximum number of Unicode scalar values in one resolved schema identifier.
    /// </summary>
    public const int MaximumSchemaIdScalars = 2_048;

    /// <summary>
    /// The maximum number of Unicode scalar values in one reference URI.
    /// </summary>
    public const int MaximumReferenceScalars = 2_048;

    /// <summary>
    /// The maximum number of Unicode scalar values in one anchor name.
    /// </summary>
    public const int MaximumAnchorScalars = 256;
}

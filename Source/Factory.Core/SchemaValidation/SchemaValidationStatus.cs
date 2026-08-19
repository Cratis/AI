// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.SchemaValidation;

/// <summary>
/// Identifies a deterministic schema validation outcome.
/// </summary>
public enum SchemaValidationStatus
{
    /// <summary>
    /// The instance satisfies the selected schema.
    /// </summary>
    Valid = 0,

    /// <summary>
    /// The instance is canonical JSON but violates the selected schema.
    /// </summary>
    Invalid = 1,

    /// <summary>
    /// The validation request failed closed before a conformance verdict.
    /// </summary>
    Rejected = 2,

    /// <summary>
    /// The complete diagnostic set exceeded the bounded result contract.
    /// </summary>
    DiagnosticLimitExceeded = 3,

    /// <summary>
    /// The instance or conservative evaluation-work budget was exceeded before package evaluation.
    /// </summary>
    EvaluationLimitExceeded = 4
}

// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.SchemaValidation;

/// <summary>
/// Identifies how one diagnostic contributes to the operation outcome.
/// </summary>
public enum SchemaDiagnosticStatus
{
    /// <summary>
    /// A canonical instance violates a schema assertion.
    /// </summary>
    Violation = 0,

    /// <summary>
    /// The request or schema resource set was rejected before a conformance verdict.
    /// </summary>
    Rejected = 1,

    /// <summary>
    /// A bounded operation limit was exceeded.
    /// </summary>
    LimitExceeded = 2
}

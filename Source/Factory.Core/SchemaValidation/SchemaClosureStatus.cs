// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.SchemaValidation;

/// <summary>
/// Identifies a deterministic closure-selection outcome.
/// </summary>
public enum SchemaClosureStatus
{
    /// <summary>
    /// The selected schema resource closure was resolved.
    /// </summary>
    Resolved = 0,

    /// <summary>
    /// The identifier is valid but is not a member of the resource set.
    /// </summary>
    NotFound = 1,

    /// <summary>
    /// The supplied identifier is not a valid schema identifier.
    /// </summary>
    Rejected = 2
}

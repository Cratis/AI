// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.SchemaValidation;

/// <summary>
/// Identifies whether a schema resource set was loaded.
/// </summary>
public enum SchemaLoadStatus
{
    /// <summary>
    /// The immutable resource set was loaded.
    /// </summary>
    Loaded = 0,

    /// <summary>
    /// The resource set was rejected.
    /// </summary>
    Rejected = 1
}

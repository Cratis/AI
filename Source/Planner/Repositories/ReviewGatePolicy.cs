// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Planner.Repositories;

/// <summary>
/// Whether a pull request in a repository needs a person before it can merge, or an agent may merge
/// it on its own once the language model classifies it as safe to.
/// </summary>
public enum ReviewGatePolicy
{
    /// <summary>A person always merges - the default, safe until a repository opts into more.</summary>
    Human = 0,

    /// <summary>An agent may merge on its own once classified as safe to.</summary>
    Auto = 1,
}

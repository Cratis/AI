// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Commands.ModelBound;
using Cratis.Chronicle.Events;

namespace Library.Authors;

/// <summary>
/// Emitted when an author is imported from the legacy catalog.
/// </summary>
/// <param name="Name">The author's display name.</param>
[EventType("6c1f0a52-3e7d-4b8e-9a41-2d5f7c8b9e10")]
public record AuthorImported(string Name);

[Command]
public record RegisterAuthor(string Name)
{
    public void Handle()
    {
    }
}

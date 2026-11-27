// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Capstone.Authors;

#region docs:author-id
public record AuthorId(Guid Value) : EventSourceId<Guid>(Value)
{
    public static readonly AuthorId NotSet = new(Guid.Empty);
    public static implicit operator AuthorId(Guid value) => new(value);
    public static AuthorId New() => new(Guid.NewGuid());
}
#endregion docs:author-id

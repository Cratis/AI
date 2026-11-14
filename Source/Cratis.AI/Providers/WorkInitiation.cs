// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers;

/// <summary>
/// Async-local initiation scopes. Agent execution scopes do not replace this identity.
/// </summary>
public class WorkInitiation : IWorkInitiation
{
    readonly AsyncLocal<WorkInitiator?> _current = new();

    /// <inheritdoc/>
    public WorkInitiator Current => _current.Value ?? WorkInitiator.None;

    /// <inheritdoc/>
    public IDisposable Begin(WorkInitiator initiator)
    {
        var previous = Current;
        if (previous.Member is not null && initiator.Member is not null && previous != initiator)
        {
            throw new InvalidOperationException("The work initiator cannot change within an active scope");
        }
        _current.Value = previous.Member is null ? initiator : previous;
        return new Scope(() => _current.Value = previous);
    }

    sealed class Scope(Action restore) : IDisposable
    {
        bool _disposed;

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;
            restore();
        }
    }
}

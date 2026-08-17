// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Buffers.Text;
using System.Security.Cryptography;
using System.Text;

namespace Planner.Work.Authorizing;

/// <summary>
/// The default <see cref="IWorkTokens"/> - issues a cryptographically random token per unit of work
/// and verifies presented ones against the <see cref="WorkAuthorization"/> read model.
/// </summary>
/// <remarks>
/// Issuing appends straight to the event log rather than going through a command on purpose: Arc
/// generates an HTTP endpoint for every command, and an endpoint that mints or overwrites a
/// worker credential would hand an attacker exactly the key this whole mechanism exists to withhold.
/// Nothing outside the dispatcher has any business issuing one.
/// </remarks>
/// <param name="eventStore">The <see cref="IEventStore"/> to append through and read back from.</param>
public class WorkTokens(IEventStore eventStore) : IWorkTokens
{
    /// <summary>
    /// The number of random bytes a token carries. 256 bits is far beyond guessable, and the
    /// base64url encoding of it stays short enough to travel comfortably in a header.
    /// </summary>
    public const int TokenByteCount = 32;

    /// <inheritdoc/>
    public async Task<WorkToken> Issue(WorkId work)
    {
        var token = new WorkToken(Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(TokenByteCount)));
        await eventStore.EventLog.Append(work, new WorkTokenIssued(token));

        return token;
    }

    /// <inheritdoc/>
    public async Task<bool> IsValid(WorkId work, WorkToken presented)
    {
        if (string.IsNullOrEmpty(presented?.Value))
        {
            return false;
        }

        var authorization = await eventStore.ReadModels.GetInstanceById<WorkAuthorization>((EventSourceId)work);

        // No token issued for this work - or one that has already been retired by a terminal event,
        // which leaves the read model default-initialized rather than absent.
        var issued = authorization?.Token;
        if (string.IsNullOrEmpty(issued?.Value))
        {
            return false;
        }

        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(issued.Value),
            Encoding.UTF8.GetBytes(presented.Value));
    }
}

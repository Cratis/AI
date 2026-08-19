// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.Conformance;

static class CanonicalJsonFailureProjectionVerifier
{
    public static void Verify(CanonicalJsonVector vector, byte[] input, List<string> failures)
    {
        if (vector.ForbiddenErrorSubstrings is null)
        {
            return;
        }

        try
        {
            CanonicalJson.Parse(input);
        }
        catch (InvalidCanonicalJson error)
        {
            var projection = $"{error.Message}|{error.Failure}";
            foreach (var forbidden in vector.ForbiddenErrorSubstrings)
            {
                if (projection.Contains(forbidden, StringComparison.OrdinalIgnoreCase))
                {
                    failures.Add($"{vector.Id}: rejection projection contains a forbidden input fragment.");
                }
            }

            if (projection.Any(character => character is '\u001b' or '\u007f'))
            {
                failures.Add($"{vector.Id}: rejection projection contains a terminal control.");
            }
        }
    }
}

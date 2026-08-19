// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.Conformance;

static class CanonicalJsonVectorOperation
{
    public static bool IsValid(CanonicalJsonVector vector)
    {
        var isCanonicalOperation = string.Equals(vector.Operation, "canonicalize", StringComparison.Ordinal) ||
                                   string.Equals(vector.Operation, "byteHash", StringComparison.Ordinal);
        if (isCanonicalOperation)
        {
            return vector.Mode is null;
        }

        return IsSelfHash(vector) &&
               (string.Equals(vector.Mode, "calculate", StringComparison.Ordinal) ||
                string.Equals(vector.Mode, "verify", StringComparison.Ordinal));
    }

    public static bool IsSelfHash(CanonicalJsonVector vector) =>
        string.Equals(vector.Operation, "contentHash", StringComparison.Ordinal) ||
        string.Equals(vector.Operation, "requestHash", StringComparison.Ordinal);

    public static bool IsCalculate(CanonicalJsonVector vector) =>
        string.Equals(vector.Mode, "calculate", StringComparison.Ordinal);

    public static CanonicalJsonSelfHashField GetSelfHashField(CanonicalJsonVector vector) =>
        string.Equals(vector.Operation, "contentHash", StringComparison.Ordinal)
            ? CanonicalJsonSelfHashField.ContentHash
            : CanonicalJsonSelfHashField.RequestHash;
}

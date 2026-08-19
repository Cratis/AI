// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.SchemaValidationParity;

sealed class ComparisonTracker
{
    readonly SortedSet<int> _failedCaseOrdinals = [];

    public int Count { get; private set; }

    public int FailedCount { get; private set; }

    public IEnumerable<int> FailedCaseOrdinals => _failedCaseOrdinals;

    public void Check<T>(T expected, T actual, int ordinal)
    {
        Count++;
        if (!EqualityComparer<T>.Default.Equals(expected, actual))
        {
            FailedCount++;
            _failedCaseOrdinals.Add(ordinal);
        }
    }

    public void CheckSequence<T>(IEnumerable<T> expected, IEnumerable<T> actual, int ordinal)
    {
        Count++;
        if (!expected.SequenceEqual(actual))
        {
            FailedCount++;
            _failedCaseOrdinals.Add(ordinal);
        }
    }
}

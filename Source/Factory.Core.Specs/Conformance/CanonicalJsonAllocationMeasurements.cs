// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.Factory.Conformance;

static class CanonicalJsonAllocationMeasurements
{
    public static IReadOnlyList<string> Measure(CanonicalJsonVectorManifest manifest)
    {
        var failures = new List<string>();
        foreach (var vector in manifest.Cases.Where(_ => _.AllocationCeilingBytes.HasValue))
        {
            var input = CanonicalJsonVectorInput.Create(vector);
            Execute(vector, input);
            GC.Collect();
            GC.WaitForPendingFinalizers();
            GC.Collect();

            var before = GC.GetAllocatedBytesForCurrentThread();
            var stopwatch = Stopwatch.StartNew();
            Execute(vector, input);
            stopwatch.Stop();
            var allocated = GC.GetAllocatedBytesForCurrentThread() - before;
            Console.WriteLine($"allocation {vector.Id}: {allocated} bytes in {stopwatch.Elapsed.TotalMilliseconds:F3} ms");
            if (allocated > vector.AllocationCeilingBytes)
            {
                failures.Add($"{vector.Id}: allocated {allocated:N0} bytes; ceiling {vector.AllocationCeilingBytes:N0} bytes.");
            }
        }

        return failures;
    }

    static void Execute(CanonicalJsonVector vector, byte[] input)
    {
        if (!CanonicalJson.TryParse(input, out var value, out _))
        {
            return;
        }

        _ = CanonicalJsonHash.Calculate(value);
        if (!CanonicalJsonVectorOperation.IsSelfHash(vector))
        {
            return;
        }

        var field = CanonicalJsonVectorOperation.GetSelfHashField(vector);
        if (CanonicalJsonVectorOperation.IsCalculate(vector))
        {
            _ = CanonicalJsonSelfHash.Calculate(value, field);
        }
        else
        {
            _ = CanonicalJsonSelfHash.Verify(value, field);
        }
    }
}

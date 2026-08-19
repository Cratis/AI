// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Json.Schema;

namespace Cratis.Factory.SchemaValidation;

sealed class SafeEvaluationOptions(long maximumRuntimeWork) : EvaluationOptions
{
    public SchemaRuntimeBudget RuntimeBudget { get; } = new(maximumRuntimeWork);

    public static SafeEvaluationOptions ForValidation(OutputFormat outputFormat) =>
        new(SchemaValidationLimits.MaximumEvaluationWorkUnits)
        {
            OutputFormat = outputFormat,
            RequireFormatValidation = false
        };

    public static SafeEvaluationOptions ForDiagnostics() =>
        new(SchemaValidationLimits.MaximumDiagnosticWorkUnits)
        {
            OutputFormat = OutputFormat.Hierarchical,
            RequireFormatValidation = false
        };
}

sealed class SchemaRuntimeBudget(long maximumWork)
{
    long _consumed;

    public bool TryConsume(long work)
    {
        while (true)
        {
            var observed = Interlocked.Read(ref _consumed);
            if (work < 0 || observed > maximumWork - work) return false;
            if (Interlocked.CompareExchange(ref _consumed, observed + work, observed) == observed) return true;
        }
    }
}

#pragma warning disable CA1064 // The evaluation sentinel is intentionally private to the package adapter boundary.
sealed class SchemaEvaluationBudgetExceeded : Exception
{
    public SchemaEvaluationBudgetExceeded()
        : base("The bounded schema evaluation work budget was exceeded.")
    {
    }
}
#pragma warning restore CA1064

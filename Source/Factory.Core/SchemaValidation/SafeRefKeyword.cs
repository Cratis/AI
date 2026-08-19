// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Json.Schema;
using Json.Schema.Keywords;

namespace Cratis.Factory.SchemaValidation;

sealed class SafeRefKeyword : RefKeyword
{
    public static new SafeRefKeyword Instance { get; } = new();

    public override KeywordEvaluation Evaluate(KeywordData keyword, EvaluationContext context)
    {
        if (context.Options is not SafeEvaluationOptions options ||
            !options.RuntimeBudget.TryConsume(SchemaValidationCostModel.ReferenceRuntimeCost))
        {
            throw new SchemaEvaluationBudgetExceeded();
        }

        return base.Evaluate(keyword, context);
    }
}

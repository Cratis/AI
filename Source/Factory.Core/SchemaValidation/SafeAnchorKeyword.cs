// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Text.Json;
using Json.Schema;

namespace Cratis.Factory.SchemaValidation;

sealed class SafeAnchorKeyword : IKeywordHandler
{
    public static SafeAnchorKeyword Instance { get; } = new();

    public string Name => "$anchor";

    public object? ValidateKeywordValue(JsonElement value)
    {
        if (value.ValueKind is not JsonValueKind.String)
        {
            throw new JsonSchemaException("factory-invalid-anchor");
        }

        return value.GetString();
    }

    public void BuildSubschemas(KeywordData keyword, BuildContext context)
    {
    }

    public KeywordEvaluation Evaluate(KeywordData keyword, EvaluationContext context) => KeywordEvaluation.Ignore;
}

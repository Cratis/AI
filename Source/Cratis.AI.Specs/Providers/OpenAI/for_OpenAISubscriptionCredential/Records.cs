// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

namespace Cratis.AI.Providers.OpenAI.for_OpenAISubscriptionCredential;

/// <summary>
/// The records the parsing specs read.
/// </summary>
public static class Records
{
    public const string Complete = """{"type":"oauth","access":"at","refresh":"rt","expires":4102444800000,"accountId":"acct"}""";
    public const string WithoutAccountId = """{"type":"oauth","access":"at","refresh":"rt","expires":4102444800000}""";
}

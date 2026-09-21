<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Anthropic credentials

`Cratis.AI.Providers.Anthropic.AnthropicCredential` accepts revealed `AIProviderApiKey` values.
It removes whitespace introduced by pasted, wrapped terminal output before classifying or sending
an Anthropic credential. This applies to both previously stored and newly entered credentials.

| Method | Result |
| --- | --- |
| `Normalize(apiKey)` | An `AIProviderApiKey` without whitespace. Use this value when building worker secrets. |
| `IsOAuthToken(apiKey)` | Whether the normalized value starts with `sk-ant-oat`, using an ordinal prefix comparison. |
| `HeadersFor(apiKey)` | Normalized OAuth bearer authorization plus the OAuth beta header, or a normalized `x-api-key` header for a console key. |

Normalize only **after revealing** a protected value. Do not normalize ciphertext or apply this
Anthropic-specific rule to other providers' credential formats. An unset credential remains unset.
Normalization does not refresh an expired token, increase account quota, or guarantee authentication.

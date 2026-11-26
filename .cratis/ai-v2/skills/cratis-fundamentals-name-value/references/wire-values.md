# Check the scalar at the wire

Serialize through the same options as the endpoint. For a standalone System.Text.Json test, register `Cratis.Json.ConceptAsJsonConverterFactory` in `JsonSerializerOptions.Converters`. Assert the JSON token is a string, then deserialize those same bytes to the concept. Checking `.Value` alone cannot catch an accidental object envelope. If the standalone check passes and the endpoint still emits an object, inspect which options that endpoint actually uses; do not change the generated client to unwrap it.

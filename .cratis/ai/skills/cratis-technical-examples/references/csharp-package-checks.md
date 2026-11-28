# Verify C# package references

In a consumer restored at the documented NuGet version and target framework,
check the package's compiler-reference metadata for the documented public type,
namespace and attribute. For an attribute written without the `Attribute` suffix,
verify the full type and the documented constructor or named properties. Compile
the example against that package when possible; a type discovered in source or
an implementation-only assembly may not be part of the consumer API.

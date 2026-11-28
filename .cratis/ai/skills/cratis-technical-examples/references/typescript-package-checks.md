# Verify TypeScript package references

In a consumer with the supported package version installed, check each documented
package subpath against the package's `exports` map. For a named import, follow
that subpath's type declarations through re-exports and verify that the exact
binding is public there, not merely declared elsewhere in the package. Compile
the example in the consumer when possible; a passing corpus link check proves
neither module nor binding resolution.

# Hydrate a TypeScript concept at the boundary

Declare `class AuthorId extends ConceptAs<string> {}` with `ConceptAs` from `@cratis/fundamentals`. The class names the value but doesn't validate its contents. A type assertion after `JSON.parse` creates no instance. On a containing model use `@field(AuthorId)` for the property and supply element metadata for collections. Deserialize with the configured `JsonSerializer`; assert both the wire string and the hydrated class. Extra properties on the concept do not survive unwrapping: put them on the containing model.

For GeoJSON use `Point`, `LineString` or `Polygon` with coordinates in longitude, latitude order. Migrate existing stored shapes explicitly before changing converters.

# Only a subset of Components styles may be loaded

Import tokens and styles/base, then each rendered area’s published styles subpath, including areas used in overlays. Keep package CSS imports in a CSS entry consumed by the bundler; a CSS side-effect import with missing TypeScript declarations is not evidence of a missing renderer.

# Import the Kotlin-generated React query

The Kotlin generator emits a query-named module separately from its model. For `AllAuthors` in `com.example.library.features.authors.listing`, with `arc.proxies.segmentsToSkip` set to `3`, `arc.proxies.useProxyFileSuffix` off and `generated/` at the frontend root, import from the component in `features/authors/listing`:

```tsx
import { AllAuthors } from '../../../generated/features/authors/listing/AllAuthors';
```

For `AuthorsNamed` in the same package, use the separate `AuthorsNamed` module. If `useProxyFileSuffix` is enabled, include `.proxy` in the module specifier. Check the emitted directory and export, then bind `AllAuthors.use()` as usual. The Kotlin generator's React sample also sets `useDefineForClassFields: false` alongside `experimentalDecorators: true`.

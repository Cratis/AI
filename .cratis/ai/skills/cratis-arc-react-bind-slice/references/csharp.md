# Import the C#-generated React query

With source-file grouping (`CratisProxiesUseSourceFileAsOutputFile=true`), the query from `Author.cs` is exported by the generated `Author` module. For `Library.Features.Authors.Listing`, with `CratisProxiesSegmentsToSkip=1`, the proxy suffix off and `generated/` at the frontend root, import from the component in `Features/Authors/Listing`:

```tsx
import { AllAuthors } from '../../../generated/Features/Authors/Listing/Author';
```

If `AuthorsNamed` is declared in the same source file it also comes from that module. Without source-file grouping, import each query by its generated query name. With `CratisProxiesUseProxyFileSuffix=true`, include `.proxy` in the module specifier. Check the generated export before binding `AllAuthors.use()`.

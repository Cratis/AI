# Preserve the provider window in kotlin

Use this in an Arc JVM query backed by a repository that can count and window the same filtered rows. Read in deterministic order; pass the resulting items, zero-based page, requested size and full count to `io.cratis.arc.queries.QueryPage`. For example, given two rows of the fourth page and forty matches:

```kotlin
return QueryPage(listOf(Row("a"), Row("c")), 3, 2, 40)
```

The response must preserve a then c, page 3, size 2 and total 40. Do not slice these two items again. If the repository cannot count the matches, expose a bounded unpaged query instead of declaring the window length as the total.

# Return a provider page in Go

In a registered `queries.WithParameters` handler, use the received `queries.Parameters` rather than decoding business arguments as paging controls. For a paged request, have the repository count the authorized matches, order by a stable key, then read at offset `p.Paging.Skip()` with limit `p.Paging.Size`. After checking both database errors, return the window and the unwindowed count:

```go
return queries.Page[Author]{Items: authors, TotalItems: int64(count)}, nil
```

For two matching authors at size one, page one must contain the second author but report two matches. Do not substitute the length of the window for the count. When paging is absent, handle that case before applying a size as a limit.

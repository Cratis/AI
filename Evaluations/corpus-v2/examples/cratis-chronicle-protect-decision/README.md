# Borrowing checks

Use .NET 10 and a disposable Chronicle kernel. Run `dotnet build Specs --configuration Release -warnaserror`, then `dotnet test Specs --configuration Release --no-build`.

The validator test covers available, missing and exhausted stock. The kernel test obtains a detached stock decision, consumes the last copy, and tries to commit a borrowing guarded by the original decision. It expects a concurrency violation and exactly one `BookBorrowed`. It checks Chronicle's protected commit, not Arc's HTTP response mapping.

# Library author contracts

Build the backend from this directory, then compile the consumer and check its routes:

```
dotnet build Library.csproj -c Release -warnaserror
npm ci
npm run test:example
```

`Features/Authors/Registration/RegisterAuthor.cs` contains the command and its validator. `Features/Authors/Listing/Author.cs` maps registration and removal and exposes the author queries. The consumer imports the corresponding files from `generated/Features/Authors/`. The output directory belongs to this producer alone.

# Package metadata

## Contents

- Field map
- Writing the description
- Pitfalls

## Field map

| Field | NuGet (`.csproj`, `Directory.Build.props`) | npm (`package.json`) |
| --- | --- | --- |
| Description | `<Description>`, 80-250 characters; the first 100 are what shows | `description`, 80-160 characters |
| Tags | `<PackageTags>`, 5-10, `cratis` plus category terms | `keywords`, the same list |
| Project URL | `<PackageProjectUrl>` = `https://www.cratis.io/<product>/` | `homepage`, the same |
| Repository | `RepositoryUrl` | `repository` |
| Authors | `Cratis` | `author` `Cratis` |
| License | `PackageLicenseExpression` `MIT` | `license` `MIT` |
| Readme | A packed README with the same opener | `README.md` |

Use a `https://www.cratis.io/<product>/` page that exists; check the docs site rather than guessing
a slug. If none exists, leave the existing URL and report it.

## Writing the description

One sentence: what it is, for whom, and which Cratis product it belongs to - "<what it is> for
<audience>, part of Cratis <Parent>". Name the parent so the package disambiguates ("the client for
Cratis Chronicle, the open-source event-sourcing database"). The text equals the README opener and
the GitHub About text. Tags are specific ("event-sourcing", "cqrs", "dotnet"); never "utilities".

## Pitfalls

- An empty `Description`.
- Mixed `Authors` values across packages of one product.
- `PackageProjectUrl` pointing only at GitHub.
- Two packages with near-identical descriptions. Where `@cratis/arc` (the browser client of Arc
  .NET) and `@cratis/arc.core` (the Node server package) could be confused, each description says
  which one it is.

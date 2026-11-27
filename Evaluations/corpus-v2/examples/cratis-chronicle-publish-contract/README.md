# Disposable Chronicle fixture

Use an isolated machine or VM with Docker Compose, .NET 10 SDK and access to the pinned NuGet packages. The fixture uses the development image with bundled storage, synthetic data, and localhost port 35000. Do not run it against an existing kernel. Run one fixture at a time. Stop if that port already belongs to another service. Do not publish the development endpoint remotely.

From this directory run `docker compose up -d`; inspect `docker compose logs chronicle` until the kernel is accepting clients. Run `dotnet build Specs --configuration Release -warnaserror`, then `dotnet test Specs --configuration Release --no-build`. Stop and remove the fixture's own storage with `docker compose down -v` when finished. A successful build alone does not exercise a kernel operation.

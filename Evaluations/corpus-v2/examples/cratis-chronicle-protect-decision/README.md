# Borrowing validator

Run `dotnet build Specs --configuration Release -warnaserror`, then `dotnet test Specs --configuration Release --no-build`. This example tests the borrowing validator with available, exhausted and missing stock. It does not run an Arc host or test a concurrent commit.

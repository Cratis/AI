# A build passed but no observation ran

Check the test project's Release inputs first: the context and facts cannot be inside a Debug-only block. Confirm it references the xUnit v3 Cratis specifications package, the matching xUnit runner and test SDK. Rebuild in Release, then list cases with `dotnet test Specs -c Release --no-build --list-tests`. Listing proves discovery only; execute the same project without `--list-tests` and check the individual result in the detailed console log.

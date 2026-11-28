# Start a Kotlin Spring Boot host

Annotate the entry class with `@SpringBootApplication` and start it from `main` with `runApplication<LibraryApplication>(*args)`. Build with the Arc adapter generation enabled so the application has endpoints to register.

Set `cratis.arc.endpoints.segments-to-skip-for-route` for the package layout in this module. Do not copy a skip count from another service: it changes the mapped path. Send a query to the Spring mapping for a registered read model and expect its data in the query result.

If a route is missing, use the generated manifest to confirm discovery, then verify the effective mapping in the running Spring host, including the method (`POST` for command execution). Compare that path against the client URL. The host derives the kebab-case routes using its `cratis.arc.endpoints` settings, including `route-prefix` and `segments-to-skip-for-route`.

# Start a Kotlin Spring Boot host

Annotate the entry class with `@SpringBootApplication` and start it from `main` with `runApplication<LibraryApplication>(*args)`. Build with the Arc adapter generation enabled so the application has endpoints to register.

Set `cratis.arc.endpoints.segments-to-skip-for-route` for the package layout in this module. Do not copy a skip count from another service: it changes the generated path. Send a query to the generated route of a registered read model. Expect its data in the query result; for a missing route check the generated manifest and endpoint prefix before changing the handler.

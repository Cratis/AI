# Run the connectivity probe in isolation

Start the kernel with its required storage using the application's local host configuration. Wait for readiness rather than a fixed startup delay. Give each run a disposable logical store or namespace; do not inherit a production connection. Keep the client alive for both append and read, then dispose it before shutting down dependencies. A restart that loses an ephemeral test database is not a connection failure.

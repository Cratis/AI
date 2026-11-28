# Java scaffold

Use a JDK 17 (point `JAVA_HOME` at it), npm, and Node.js `^20.19.0` or `>=22.12.0`. The scaffold contains a Java Spring Boot backend, a Gradle wrapper, and a React + Vite frontend.

```sh
cratis new cratis --language java -n Library -o Library --version 1.9.2 --packageManager npm --allow-scripts no
cd Library
```

Use profile `cratis/application/java` and languages `java,typescript`. After the shared AI and Compose checks:

1. Run `./gradlew build` in `Library` before starting Vite. The build must succeed and generate TypeScript proxies in `build/generated/arc-proxies/`, which the frontend imports.
2. Run `npm install`, then start the backend with `./gradlew bootRun`. Spring Boot uses port 8080. Do not expose this development server to untrusted traffic.
3. In a second terminal in `Library`, run `npm run dev`. Vite serves port 9000 and proxies `/api` and `/.cratis` to port 8080. Do the React smoke check.

Use these manual steps rather than the generated `run.sh`: the script tears down Compose containers on exit, which discards the default MongoDB data.

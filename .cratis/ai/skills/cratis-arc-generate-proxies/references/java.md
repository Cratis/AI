# Generate from Java contracts

Run the Java producer's Gradle `generateArcProxies` task after compiling the Java contracts. For the Spring Boot sample the invocation is `./gradlew :Samples:Java:SpringBoot:generateArcProxies --no-configuration-cache`. Check the output for the record's public wire fields and any exported types used by the UI. Verify a generated command actually calls the mapped Spring route.

---
name: cratis-chronicle-deploy-kernel
description: Use when an operator needs to run a Chronicle kernel container, configure production storage and TLS, or diagnose a readiness probe. Not for registering an application client (use cratis-chronicle-connect-application).
compatibility: Docker, curl, and a Chronicle image release matching the application.
---

# Start a Chronicle kernel and check readiness

For a disposable workstation, use the development image. For shared environments, use the production image: the development build generates certificates, provides development credentials and can bundle an unauthenticated database. Changing the environment name does not change the build.

If the kernel opens the wrong store, refuses writes during an index rebuild, or loses writer ownership, [check storage configuration and ownership](references/storage.md). For a multi-node deployment or least-privilege SQL rollout, [prepare membership and schema](references/storage.md#choose-cluster-membership). If a webhook registers but the receiver sees no event, [verify delivery and quarantine probes](references/webhooks.md).

## Local development

Use a fresh container name and free loopback port. The full development image includes MongoDB; no database port needs publishing. This example deliberately uses disposable container storage:

```sh
docker run -d --name library-chronicle-dev -p 127.0.0.1:35000:35000 cratis/chronicle:19.184.3-development
curl -kf https://localhost:35000/health/live
curl -kf https://localhost:35000/health/ready
```

A connection refusal immediately after launch can mean the listener hasn't bound yet. Liveness returns 200 once it accepts requests; readiness can still return 503 during startup. Retry readiness before connecting the application (`cratis-chronicle-connect-application` skill in `cratis/chronicle/client-dotnet`). `-k` is only for this loopback check of the generated certificate. After the test, `docker rm -f library-chronicle-dev` removes this disposable container; don't use it to reset a persistent store.

## Shared deployment

1. Provision persistent storage first. For MongoDB use a reachable replica set, not standalone `mongod`: appends need transactions. Provision a TLS certificate valid for the service hostname and an encryption PFX with its private key for the internal OAuth authority. Restrict setup access to operators.
2. Mount the configuration as `/app/chronicle.json` and certificates read-only. For example, with certificates mounted at `/certs`, use this file and inject the actual storage connection and certificate passwords from the secret manager through `Cratis__Chronicle__Storage__ConnectionDetails`, `Cratis__Chronicle__Tls__CertificatePassword` and `Cratis__Chronicle__EncryptionCertificate__CertificatePassword`. Environment overrides file settings.

```json
{
  "tls": { "certificatePath": "/certs/service.pfx" },
  "encryptionCertificate": { "certificatePath": "/certs/encryption.pfx" }
}
```

3. With the three secret variables above already injected into the operator's environment, `chronicle.json` and `certs/` in the current directory, and an existing private Docker network `library-backend`, start the production build:

```sh
docker run -d --name library-chronicle --network library-backend \
  -v "$PWD/chronicle.json:/app/chronicle.json:ro" -v "$PWD/certs:/certs:ro" \
  -e Cratis__Chronicle__Storage__ConnectionDetails \
  -e Cratis__Chronicle__Tls__CertificatePassword \
  -e Cratis__Chronicle__EncryptionCertificate__CertificatePassword \
  cratis/chronicle:19.184.3
```

   Probe from inside the private network using the service name on the certificate. Route clients to port 35000 over trusted TLS with HTTP/2 support; do not expose the database or Orleans cluster ports to clients. With the default Chronicle HTTP authentication and no bootstrap password, complete administrator setup privately with the initial setup token before opening access. Never publish logs containing the token.
4. Probe `/health/live` for liveness and `/health/ready` for readiness. For example, with `KERNEL_URL` set to the trusted HTTPS service URL, `curl -fsS "$KERNEL_URL/health/ready"` should succeed; don't disable certificate checks. If live but not ready, check storage connectivity and startup diagnostics before restarting. If neither responds, check listener configuration, certificate mount paths and permissions.
5. Before replacing a persistent kernel, test restoration in isolation: restore the encryption certificate ring and passwords from backup time, then the database, then any separate compliance key store at the same recovery point. Preserve confirmed erasures when restoring; don't reintroduce deleted keys. Bring up one node and check readiness and decryptability before admitting traffic. Keep the previous configuration and image digest; reverting an image does not undo storage writes.

For a compliance backend change, [cut over the key store without losing access to existing keys](references/storage.md#cut-over-to-a-dedicated-compliance-key-store).

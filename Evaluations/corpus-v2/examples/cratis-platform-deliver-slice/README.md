# Verify Register author on the live application

Use the real command, projection, observable query and generated client. The standalone scenario in `../cratis-specifications-exercise-backend` checks accepted and blank-name dispatch; it does not prove projection delivery. This journey checks the successful write through to the screen and persisted row.

Set `AUTHORS_FIXTURE_ADAPTER` to the absolute path of a trusted local ES module exporting `start()`. The adapter owns the app-specific setup: validate disposable bindings before connecting, start the host on loopback with a fresh namespace, arrange a permitted catalog editor, then open the real Authors route in Playwright. Do not intercept application traffic. Return:

- `page`: the authenticated Playwright page, on a loaded empty Authors list.
- `readRegistrations()`: all `AuthorRegistered` facts in the namespace as `{ source, name }` and all materialized rows as `{ id, name }`, in `{ facts, rows }`. Read actual state; do not reconstruct it from the submitted values.
- `close()`: dispose the browser, host and namespace. `start` must also clean up if setup fails before it returns.

With that adapter configured, run `npm run test:journey` here. Expect one Aster row without reload, the same row after reload, one matching fact at the submitted source and the matching materialized row. Missing adapter, inaccessible form, missing update or duplicate registration must fail the test. The adapter is not bundled: without the disposable app and adapter this contract is unverified.

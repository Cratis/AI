# Verify Register author on the live application

Use the real command, projection, observable query and generated client. The standalone scenario in `../cratis-specifications-exercise-backend` checks accepted and blank-name dispatch; it does not prove projection delivery. This journey checks the successful write through to the screen and persisted row, and checks that the form prevents a blank submission.

Set `AUTHORS_FIXTURE_ADAPTER` to the absolute path of a trusted local ES module exporting `start({ id })`. The adapter owns the app-specific setup: validate disposable bindings before connecting, start the host on loopback with a fresh namespace, arrange a permitted catalog editor and fixed registration ID, then open the real Authors route in Playwright. Do not intercept application traffic. Return:

- `page`: the authenticated Playwright page, on a loaded empty Authors list.
- `readRegistration(id)`: inspect the same store and namespace, returning all registration facts for this source as `{ source, name }` and the materialized row as `{ id, name }`, in `{ facts, row }`. Read actual state; do not reconstruct it from the submitted values.
- `close()`: dispose the browser, host and namespace. `start` must also clean up if setup fails before it returns.

With that adapter configured, run `npm run test:journey` here. Expect one Aster row without reload, the same row after reload, one matching fact at the submitted source and the matching materialized row. Missing adapter, inaccessible form, missing update or duplicate registration must fail the test. The adapter is not bundled: without the disposable app and adapter this contract is unverified.

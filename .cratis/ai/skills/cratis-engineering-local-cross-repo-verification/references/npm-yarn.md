<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# npm and Yarn

## Pack the package, not a link

Requires node and Yarn 4. Run the producer's normal build first. The helper does
not run a separate build; Yarn's normal pack lifecycle hooks still run.

```bash
stamp=$(bash "$local" stamp "$producer")
bash "$local" pack-npm "$producer" "$stamp"
```

It requires clean tracked workspace manifests, temporarily changes all non-private
workspace versions and packs actual tarballs. It restores those manifests on
success and failure; inspect diffs for other lifecycle-generated output. Yarn's
`%s-%v.tgz` output slugifies a scoped name (`@cratis/foo` becomes `@cratis-foo`).
Inspect dependency ranges in packed manifests: the helper changes versions, not
arbitrary inter-package dependency constraints. Include every required workspace
and verify the consumer resolves the intended tarballs.

Do not use `portal:` or `link:` for this proof: filesystem package boundaries can
create duplicate React instances or mismatched context providers, and may hide
missing packed files. A tarball exercises what a downstream install receives.

## Consumer overlay

```bash
bash "$local" use-npm "$consumer" "$stamp"
cd "$consumer"
yarn install
# Run the repository's frontend build, lint, specs and reproducing UI action.
```

The helper inspects tracked manifests, selects tarballs for referenced package
names, and adds root `resolutions` using absolute `file:` tarball paths. It backs
up root `package.json`, `yarn.lock` if present, and the pre-existing diff in the
per-worktree session. It refuses another active npm backup. Check the install
output/lockfile for the selected local versions; a successful install alone is not
proof that the changed code was exercised.

If Vite still serves the old package, stop the dev server and clear only the
consumer's stale `node_modules/.vite` prebundle, then restart it. Never edit
`node_modules` files to implement the fix. `use-npm` does not run install or clear
caches itself. Unique stamps avoid tarball cache collisions.

## Restore without discarding work

```bash
bash "$local" restore "$consumer"
bash "$local" check "$consumer"
```

Restoration is deliberately conservative: it copies saved manifests only if the
current manifest matches either the expected overlay or original, and the
lockfile still matches its backup. Yarn install usually changes `yarn.lock`, so
the helper can refuse even an expected workflow change. It retains backups and
restores nothing on that conflict. Review the saved before-diff and files, undo
only local overlay/lockfile changes manually, and retry. If user changes were
made afterward, merge them instead of replacing them with the backup. Do not
blindly checkout the consumer manifests. Reinstall released dependencies after
restoration, then run `check` before any commit/push.

Review `clean "$consumer" --stamp "$stamp"` before `--apply`. Passing the consumer
allows Yarn cache discovery; no consumer or unavailable Yarn yields a reported
skip. Unresolved backups block cleanup rather than silently losing recovery data.

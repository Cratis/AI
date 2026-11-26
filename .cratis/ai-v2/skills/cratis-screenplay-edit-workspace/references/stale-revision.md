# Recover a rejected proposal

On a stale revision or changed disk snapshot, keep the original intent but discard its handles and proposal. Read the workspace again, compare intervening edits, resolve identities in the new snapshot and propose anew. Show the new diff to the owner before apply. Do not patch the file around the server or reuse an earlier acceptance after a release baseline changed.

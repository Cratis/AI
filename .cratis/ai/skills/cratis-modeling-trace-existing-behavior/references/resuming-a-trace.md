# Resume an evidence trace

At each pass, record per feature or journey the code revision, whether uncommitted input was included (and a digest of that input), the baseline model revision and each evidence locator. Record the inspected inputs' digest if the revision alone cannot identify them. Compare the recorded revision with the new one only if history and input identity are trustworthy.

- Diff from that watermark and follow affected callers, producers and consumers beyond the changed files. A moved, renamed or deleted locator is stale even if the content seems identical: re-verify it before carrying forward its finding.
- If history was rewritten, either input tree is dirty, or the watermark can't be recovered, fully retrace affected journeys. If their boundary is uncertain, retrace the whole scoped feature.
- Close the pass with a loss table: item and evidence, class, owner or next check. Distinguish **not examined**, **not observed**, **not expressible** (model limit or generator diagnostic), and **awaiting owner decision**. Record discarded or regenerated draft files and any generated-file cleanup still pending. Do not clean another owner's files.

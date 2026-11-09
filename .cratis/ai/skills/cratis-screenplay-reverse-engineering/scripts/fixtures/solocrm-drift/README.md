# SoloCrm process-drift case

Read-only source: SoloCrmIn5Minutes, `0cd6557..df908a2`. The first revision's
`Screenplay/Crm.play` has 31 slices and no Today feature. The later revision adds
OverdueTasks, TasksDueToday and DormantOpportunities plus hand-written date rules.

`change.diff` excerpts `git diff --unified=2` for the two existing C# query files and
includes the complete added TodayRules.cs. The generated Tasks.ts retains its header
only; yarn.lock, scene.json and src/stage-scene.json retain file/hunk headers only.
Original hunk ranges are retained: this is a scope fixture, not an applyable patch.
Other changed files, including Crm.play, are deliberately omitted. The keep list is
relative to these excerpts, not a claim that the full revision has no other drift.

`evidence-map.json` projects every baseline slice to its rendered source folder.
RE-E1 through RE-E31 are fixture-local evidence ids: each `modelLocator` cites the
baseline declaration, not a claim that implementation behavior was verified.
Paths include generated proxies so the artifact precedence is exercised. The two
watermarks carry SHA-256 digests of the respective `Screenplay/Crm.play` inputs,
not digests of the entire repositories. No private checkout is needed to run the test.

`expected.json` is the complete expected scope result: two existing flows to
re-derive, 29 to keep, and one unmapped Today source candidate with symbols for
overdue, due-today and dormant rules. It is a work list, not an accepted model delta.

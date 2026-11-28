# Dependency waves

Tabulate **slice | owner | depends on** for the accepted scope. Include fact-to-view and other data dependencies, command invocations and calls across slices. Include external dependencies explicitly; flag any edge to an undeclared slice and resolve cycles with the owner before scheduling. Don't mock an unresolved producer to claim acceptance.

Place dependency-free slices in the first wave, then place each remaining slice in the earliest wave after all its prerequisites finish. Parallelize only with settled inputs, identities and contracts. For example, a query consuming registration and a reaction invoking another slice's command each need their own dependency edges.

Estimate from completed slices of comparable realization classes; keep generated, manual and external integration work separate rather than averaging them. Give a throughput range from observed completions (or report insufficient history). For each wave, sum work by owner and estimate duration from the most heavily loaded owner at their actual capacity, not total work divided by headcount. Record capacity and shared-owner assumptions alongside the range.

# Read a scoped observer snapshot

Select the store and namespace before opening observers. Record observer identity, sequence, last handled position and next expected position; then look for an unresolved failure for the specific partition. Record the failure's position, category and attempt count without copying raw exception text or payload. A resolved historical attempt is not evidence of a current block. Compare a second snapshot if lag versus ongoing progress is unclear.

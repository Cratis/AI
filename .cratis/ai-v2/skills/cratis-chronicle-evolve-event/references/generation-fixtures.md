# Test a migration on representative data

Use original serialized names and include missing optional fields, punctuation and compound names. Register the old schema alone and write a sentinel before deploying the new definition to test actual backfill. Also write a new-generation sentinel after deployment and check the old reader. A split string need not have an inverse: document the supported legacy representation and preserve the original when a lossless mapping is required.

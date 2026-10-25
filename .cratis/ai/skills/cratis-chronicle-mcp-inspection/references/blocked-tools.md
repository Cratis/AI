<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Effectful and unknown Chronicle MCP tools

Hand-maintained classification for `Cratis/Chronicle.Mcp`. These three
tools are effectful, never `passive-allowed`; unknown subjects are
`evidence-blocked`. All three are closed-world and declared idempotent.

| Tool | Effect | Source |
| --- | --- | --- |
| `stop_job` | mutating, non-destructive; stops a job, retains state | [JobTools.cs](https://github.com/Cratis/Chronicle.Mcp/blob/main/Source/Tools/Jobs/JobTools.cs) |
| `resume_job` | mutating, non-destructive; resumes a Stopped job's remaining steps | [JobTools.cs](https://github.com/Cratis/Chronicle.Mcp/blob/main/Source/Tools/Jobs/JobTools.cs) |
| `delete_job` | mutating, destructive; removes the job and progress irreversibly | [JobTools.cs](https://github.com/Cratis/Chronicle.Mcp/blob/main/Source/Tools/Jobs/JobTools.cs) |

Only the `Mutation` deployment profile registers these tools, and every call
needs a current matching grant. A matching grant is not user confirmation:
`delete_job` has no server prompt. Capture the exact target's current state,
explain consequences and require explicit authorization before an authorized
operator acts. Never bypass a guard to reach MCP instead.

A read tool used for unbounded payload access is also blocked until narrowed.
New or changed tools require fresh immutable implementation, schema, effect,
output and redaction evidence; read-sounding names and annotations alone do not
admit them. See [deployment and authorization](deployment.md) for the policy and
denial contract.

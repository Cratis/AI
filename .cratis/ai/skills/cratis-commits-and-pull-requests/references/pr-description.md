# Describe the delivery

Use the repository's PR template. Where the PR body supplies the published release notes, use only applicable `Added`, `Changed`, `Fixed`, `Removed`, `Security` and `Deprecated` sections with short, user-facing bullets. Include migration guidance for breaking changes. Put verification, test and CI results and other reviewer context in a PR comment, not in the body. Do not narrate the work in the release note.

If `cratis/release-action` closes issues from the notes, end the delivering bullet with `(#n)` only for an issue this PR fully delivers and is authorized to close. Use one reference per issue (`(#1) (#2)`), never the PR number. Use `(part of #n)` or `see #n` for incomplete or related work, and omit the reference when there is no issue. Do not prefix issue numbers with linking or closing keywords. Where a different publisher is in use, follow the repository's issue-closing process.

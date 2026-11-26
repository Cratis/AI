# Fix only values that affect the decision

Use a named example for the valid input and override one field in the contrasting case. Keep a source ID constant across command, expected event and projected row; give unrelated histories different IDs. A caller role belongs in `given caller`, not in the fact payload. If time matters, pin the instant rather than placing the current date in reusable data.

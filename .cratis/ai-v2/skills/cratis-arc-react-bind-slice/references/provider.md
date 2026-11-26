# The view runs in a separate frontend host

Place the Arc provider above the route, not inside each row. Configure the API origin at that boundary. A successful frontend navigation proves nothing about the API base path: inspect the actual command and subscription URLs.

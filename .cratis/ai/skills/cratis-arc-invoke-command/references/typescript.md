# Execute through the command pipeline

Use `server.execute(instance, context)` for a registered class instance; use `server.executeCommand(name, input, context)` for a named command and unbound input. Carry the verified principal and tenant. A resolved promise is not proof of success. Inspect authorization, validation results and exceptions before consuming the response. Distinguish no transport response from a completed refusal; do not retry an ambiguous write blindly.

| Stage | If it stops |
| --- | --- |
| Authentication, tenant selection/membership | 401, or 400 missing required tenant / 403 nonmember |
| Parse, declared authorization, bind, request authorization | malformed request 400 or denial 403 |
| Context resolution and global authorization filters | resolution failure or denial; handler does not run |
| Global filters, validation and definition filters | findings 400, filter exceptions 500 |
| Provide and handle, response handling and operations | classify the returned outcome; do not use a failed response |

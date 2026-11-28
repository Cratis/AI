# Reject invalid input before the write

Attach `commands.WithValidator` to the command's registration; supported model tags supply declarative field rules. Do not assume a validator function is discovered just because its parameter has the command type. Return findings that identify the input member. Call the pipeline with a bad value and inspect both the Go error and the result: ordinary validation can refuse with no Go error. Assert the field and zero writes; let a valid value reach the handler.

# Narrow the delivery contract

Replace “author management” with one checkable change: on an empty Authors screen, a permitted editor submits Aster and sees one new row; on blank input, the name is refused and no row is added. Renaming, uniqueness and deletion are separate decisions. Record the source key and namespace independently so validation against another tenant or another author cannot accidentally satisfy the check. Agree on the observable result before deciding whether the slice actually needs an event history.

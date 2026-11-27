# Check one rule across independent cases

Choose a named table when the steps are identical and only the values change. Add it beside the Library registration specifications:

```play
specification RecordingAuthorNames
  parameter name String
  case AsterName name = "Aster"
  case BirchName name = "Birch"
  when Aster name = case.name
  then AuthorRegistered
    for "11111111-1111-4111-8111-111111111111"
    name = case.name
```

Run `screenplay test model --format json`; check `RecordingAuthorNames_AsterName` and `RecordingAuthorNames_BirchName` separately.

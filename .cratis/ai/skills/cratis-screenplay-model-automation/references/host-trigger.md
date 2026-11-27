# Review welcomes on a host signal

Declare `trigger DirectoryWelcomeReviewRequested` at the model root. Keep `DirectoryWelcomeReviewDue` in `ScheduleWelcomeReview` and replace its reaction and specification with:

```play
reaction ReviewWelcomesOnRequest
  when DirectoryWelcomeReviewRequested
    produces DirectoryWelcomeReviewDue
      for "directory-welcomes"

specification ReviewingWelcomesOnRequest
  when trigger DirectoryWelcomeReviewRequested
  then DirectoryWelcomeReviewDue
    for "directory-welcomes"
```

Run `screenplay test model --format json` and check that `ReviewingWelcomesOnRequest` passed. The specification supplies the signal; the host must still raise it at runtime.

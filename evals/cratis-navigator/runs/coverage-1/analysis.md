# Navigator coverage batch 1

## Result

| Condition | Strict exact | Contract | Decision | Structurally valid | Observed output violations |
| --- | ---: | ---: | ---: | ---: | ---: |
| Pilot | 1/4 | 2/4 | 3/4 | 4/4 | 0 |
| Baseline | 0/4 | 0/4 | 2/4 | 0/4 | 1 |

The pilot strictly handled passive CLI route identification. Java/Kotlin
clarification matched the presence/absence contract but used different freeform question wording
from frozen gold. It preserved quoted destructive CLI text as passive and chose
the correct candidate, but emitted candidate metadata trust (`passive`) before
revision-bound evidence. The confusable Minecraft case used the right reason
code but blocked instead of abstaining.

The baseline used no valid output schema. One baseline selected an executable
skill path and emitted local absolute paths; these were redacted before
persistence. Baseline decisions happened to match two gold decisions but used
incompatible candidate IDs, enums, evidence states, stale revisions, and trust.

The contract now makes both boundaries explicit:

- unverified target trust is always `unknown`, regardless of candidate metadata;
- a confusable Cratis-like signal without established Cratis intent abstains.

Coverage batch 2 repeats N07 and N13. This evidence does not promote the pilot.

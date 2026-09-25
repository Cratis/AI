---
name: cratis-content-length
description: Decide how long a piece of content should be, when to keep it short, when it earns more length, and where to split it, for feed posts, documents and carousels, video, social threads, community posts, blog articles, tutorials, newsletters and release notes. Use when planning, drafting or reviewing content length, or a batch whose lengths are all the same. Do not use for SEO scoring or authorship detection.
license: MIT
---

# Content length

Most length advice starts from a number and works backward. A post should be 1,300
characters, an article should be 2,000 words, and the draft gets stretched or trimmed until
it fits. The numbers usually come from someone else's audience, and they measure engagement
rather than whether anyone could use what they read.

Start from the reader. Someone opened this piece to do something: decide whether a tool
fits, run a command, understand why a replay failed, find out what changed in a release. The
piece is long enough when that reader can do it. Past that point each sentence costs them
attention. Short of it, they go somewhere else to finish.

Two things follow. A short piece carries one idea. If it needs a second idea to make sense,
it is a longer piece or two pieces. And the evidence you have puts a cap on length. One
observation won't carry a 2,000-word essay without padding, and a migration with four
required steps won't fit in a 400-character post.

The bands below are editorial starting points. None is a proven optimum, and several rest on
weak evidence. The table says which.

## Decide the length before drafting

1. Name the reader's job in one sentence. "Understand why a projection rebuild is slow" is a
   job. "Raise awareness of projections" gives you no way to tell when the piece is done.
2. Count what the job needs: the ideas the reader must take away and the steps they must
   perform. One idea and no steps is a short post. Three steps and a failure check is a
   tutorial, whatever channel it ends up on.
3. Choose the vehicle before the word count. Short post, document, article, tutorial, video
   or release note: the vehicle decides the unit you count and which band applies.
4. Draft to the job, then compare the draft with its band. Inside the band, move on. Outside
   it, you need a reason you can say in one sentence.
5. Exceeding a platform limit requires shortening or another vehicle. Don't compress the
   draft until the steps stop working. At a soft trigger, review navigation and completeness;
   keep the piece together when the reader's task justifies it.

Count in the unit the channel counts. LinkedIn's limit, as third parties report it, counts
characters including spaces, emoji and line breaks. X counts weighted characters, with special rules for emoji, URLs and some Unicode ranges; use its documented counter rather than ordinary string length. Bluesky
limits graphemes and bytes separately, and Mastodon's limit depends on the instance. Video is
seconds, documents are pages, and articles and tutorials are words.

### When to go shorter

- The piece makes a single distinction, such as the difference between two commands, and
  one example shows it.
- A maintained source already holds the depth. A post that points to a documentation page or
  a runnable sample should give one useful finding in the post, then link the maintained
  source for the full procedure or evidence.
- The audience is cold. People who don't know the product won't read five paragraphs to learn
  whether it concerns them.
- The second half says the first half again, or the ending restates the opening as a lesson.

### When it earns more length

- A worked example the reader can follow from input to observed result.
- A method. When you report a result, say how you got it, what you compared and what you
  didn't control. Vercel's write-up of a 91% cut in P99 metadata lookup latency is long
  because it walks through the experiments. Take them out and the number has nothing
  behind it.
- A counterargument or simpler alternative, with enough room to be fair to it.
- A procedure that breaks if you cut a step: setup, the run, how to tell it worked, what to
  do when it didn't, and cleanup.

Don't pad to reach a band. No scene-setting paragraph, no closing summary, no second example
that shows the same thing. And don't cut a required step, a version or a material limit to
get under one. If the job doesn't fit the vehicle, change the vehicle.

## Pilot bands by type

A ceiling is either a **platform limit**, where the channel refuses more, or a **soft
trigger**, where you stop and review navigation and completeness, and keep the piece together
when the reader's task justifies it. Grades describe the source, not how
sure the number is: Official is the platform's own documentation or rules, Vendor is an
observational study of a tool vendor's users, Practitioner is guidance or a case example,
and Small study is one channel or a small sample. **Weak** means no verified outcome study
backs that number on that channel. It is still usable for planning.

| Type | Pilot target | Ceiling | Shorter when / longer when | Evidence |
| --- | --- | --- | --- | --- |
| LinkedIn personal post | 500–1,300 characters for one point; 1,300–2,500 for an account with evidence | 3,000 characters, platform limit as reported by a third party; check the composer | One distinction / a real example, method or counterargument | LM-01–03, Vendor and Practitioner; personal profiles only, not causal |
| LinkedIn company page post | 400–1,200 characters | 2,000 soft trigger; 3,000 reported limit | An update that points to a doc / scope or evidence the claim needs | LI-11, LM-03, LM-06; **Weak** |
| LinkedIn document | 5–9 legible pages, one idea per page | 12 pages, soft split trigger; the upload allowance is not a target | One fact fits one image / distinct steps or trade-offs | LM-10–12, Small study and Practitioner; **Weak**, one channel and click-inflated |
| LinkedIn native video | 20–60 seconds | 90 seconds, soft trigger for a feed clip | One visible action / a demonstrated sequence, captioned | LM-18, Vendor; **Weak**, hosted video, not feed video |
| X post | 80–240 weighted characters | 280 weighted characters, platform limit for ordinary posts | One proposition / link an artifact instead of forcing a thread | LM-15, Official limit; **Weak** target |
| Bluesky post | 80–260 graphemes | 300 graphemes and 3,000 bytes, platform limit | One observation / only self-contained context | LM-13, Official limit; **Weak** target |
| Mastodon post | 80–350 characters | 500 characters by default; check the instance | Same as Bluesky | LM-14, Official default; **Weak** target |
| Social thread | Each installment stands alone | No numeric ceiling; if it needs numbering to make sense, write an article | Rarely longer; see splitting below | No verified evidence; **Weak** |
| Community answer (Reddit, GitHub Discussions, forums) | The direct answer, plus only the context or code the question needs | No numeric ceiling; follow the community's rules | You've answered already and can link / the asker needs a reproducible answer | No verified length evidence; **Weak** |
| Hacker News | Not drafted by AI; see below | None set here | None set here | HC-13, HC-16, Official |
| Blog article | Quick answer 500–900 words; argued essay 1,200–2,200 | 3,000 words, soft split and navigation trigger | One answer / evidence, method, examples, alternatives | DP-03, DP-17, Practitioner and case; **Weak** |
| Technical tutorial | 1,000–2,500 words, end to end | 3,500 words, soft split trigger; never cut a required step | A bounded how-to / setup, result, failure check, cleanup, version caveats | DM-03, DM-23, Survey; **Weak** band |
| Newsletter | 150–350 words for one update; 350–600 for a digest | 600 words, soft trigger to link out or split | One takeaway / distinct items readers asked for | No verified body-length evidence; **Weak** |
| YouTube Short | 20–60 seconds | Check current YouTube Help before upload; no verified maximum here | One visible behavior / only if the result needs it | LM-18 as a proxy; **Weak** |
| Long video or demo page | 5–15 minutes | 30 minutes, soft trigger for chapters or a split; training can run longer | One operation / architecture, setup and observed outcome | LM-19–20, Vendor; **Weak** transfer |
| Release note and announcement | One or two sentences per change; announcement 250–600 words | No hard ceiling; split by job | Routine fixes / breaking behavior, affected versions, action, rollback limits | DP-25, Practitioner; **Weak** band |

Sources, populations and dates for every ID are in
[the length evidence](references/length-evidence.md), along with length claims that are
folklore.

A few rows need a closer reading:

- **The LinkedIn personal band.** It comes from AuthoredUp's study of 372,126
  personal-profile posts, where posts of 1,301–2,500 characters had about 27% higher
  engagement than posts under 400. That is an association on personal profiles. It doesn't
  show that length caused anything and says nothing about company pages, and the medians
  barely move above 1,300 characters (2.61% to 2.67%). Treat it as permission to write long
  when there is something to say.
- **The fold.** Only about 140 characters on mobile and 210 on desktop show before "see
  more", by third-party measurement. Put a complete proposition in that space whatever the
  total length. The opening itself is covered in **cratis-social-feed-post**.
- **LinkedIn media.** Posts lead with media by default, and a text-only post is a deliberate
  choice recorded with the post. That is the Cratis editorial default and an open
  hypothesis being measured, not a proven effect. For length, it means the text and the asset
  divide the work: decide what the asset carries, write the text for what it doesn't, and
  count a document's pages as part of its length. Every asset carries the Cratis mark, and
  captures are framed, never stamped. The media and branding rules live in
  **cratis-social-feed-post**.
- **Release notes.** The split into exact-version note, migration guide and announcement
  belongs to **cratis-release-notes**. Use the band here only to notice when one of them is
  trying to do another's job.

### Hacker News

No length is set here for HN because AI doesn't write or edit anything Cratis posts there:
titles, text or comments. HN's guidelines prohibit generated or AI-edited comments. Applying
that to everything Cratis posts on HN is our own stricter policy, broader than what HN's text
says. A person writes it. An agent may gather facts and links for that person to check.

## Vary length across a batch

Look at the last 10–20 pieces on one channel together. Write down each one's length in the
channel's unit and sort the list. When nearly all of them land in the same narrow band, the
batch reads as a template before anyone gets to the subject. Structural sameness in general is
covered in **cratis-writing-voice-and-cadence**; this section is about length only.

Fix the spread by subject. Don't pick lengths at random. Go back through the queue and run
the procedure above for each piece. Some subjects are a single distinction and should be short.
Some come with a worked example and should run long. A post padded to be this week's long one
is worse than the template it replaces.

For a LinkedIn account, pilot these mix targets:

- In any 10 consecutive posts, at least two short one-idea posts under about 600 characters.
- In the same 10, at least two longer worked-example or method posts over about 1,500
  characters.
- The rest in between, with no more than about half of the 10 inside any single
  400-character window.
- For media-led posts, page counts vary too. Not every document has eight pages.

These are editorial targets to measure against, not optima. No study says two short posts in
ten does anything for an account. Record the length with each post and revise the targets
once you have a few months of your own results.

The same idea applies elsewhere: mix quick how-tos with end-to-end tutorials, quick answers
with argued essays, and single-update newsletters with digests. If the queue can't meet the
mix because every planned subject has the same shape, the subject list is the problem. Take
that to whoever owns the editorial plan rather than padding or trimming to hit the numbers.

## Split long work

Split where the reader's jobs divide. The midpoint of the word count is almost never one of
those places.

- **Canonical piece with native entry points.** The full article, tutorial or sample lives in
  one maintained place with versions and limits. Each channel gets an entry point written for
  it that is useful without the click: one finding, one image or document, and the link. Most
  long work should go this way.
- **Document post.** Use it when the material is a sequence of distinct steps or trade-offs,
  one per page. Past about 12 pages, review whether it reads better as two documents or an
  article; keep it together when the reader's task justifies it.
- **Series.** Use it when the parts are separate jobs a reader might want on different days,
  such as setup, then modeling, then operations. Each part names its job, works alone and
  links to the others. No cliffhanger endings.
- **Thread.** Only when every installment is worth reading alone. A thread that exists
  because the copy didn't fit in one post is an article split into pieces nobody can find
  again.

## Shorten without losing a claim

Cut in this order: the preamble, restatements and closing summaries, a second example that
shows the same thing, background this reader already has, and optional depth that can move to
the linked source.

Leave alone the required steps, the version and environment, every material limit, every
hedge that changes what the reader does, and the source of every number. After cutting,
check that each identifier, number and limiting word from the longer draft survived. The
check is described in **cratis-writing-voice-and-cadence**. If the piece still won't fit
a platform limit after that, the vehicle is wrong.

## Check whether the length worked

Measure what readers did after reading. Useful signals are substantive
comments (a question about the mechanism, a counterexample, someone saying they tried it),
visits to the linked page or sample through tagged links, and task completion where the
product already measures it lawfully. Engagement rate says little about length. Document
engagement can include the clicks that advance pages, and a click to the next page tells you
nothing about whether the reader understood it.

Record length, unit, type and account with each piece. Compare within one account and across
similar subjects, and report raw counts with their denominators alongside any rate. Ten or
twenty posts is a small sample. Subject and timing can confound the comparison; these sources
do not establish their effects relative to length. Treat a result that changes with one
additional post as inconclusive. Write the
question and what would answer it before the pilot starts.

## Stop conditions

- Stop and ask the owner when the reader's job can't be named in a sentence.
- When the job can't be done inside a platform limit without cutting a step or a material
  limit, split or change the vehicle. Past a soft trigger, keep the piece together when the
  reader's task justifies it. If the owner still wants the band, report the conflict.
- Require sources for empirical claims and platform limits; label unsourced editorial
  targets as hypotheses.
- Stop at Hacker News. A person writes anything posted there.
- Planning or reviewing length never authorizes publishing, scheduling, uploading or
  replying. An agent does none of these.

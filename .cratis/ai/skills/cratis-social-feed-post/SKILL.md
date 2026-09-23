---
name: cratis-social-feed-post
description: Write or review a short post for a social feed such as LinkedIn, where the opening has to survive the feed's truncation, the body is plain text with no markup, and the common formatting tricks cost accessibility and reach. Use when drafting, adapting or reviewing a feed post. Do not use for documentation pages, release notes, long-form articles, or anything rendered as Markdown.
license: MIT
---

# Social feed post

A feed post is not a short article. The feed shows a few lines and hides the rest behind a
"see more" control, so the opening is not an introduction to the point — it is the entire
advertisement for the post, and the decision to expand is itself a ranking signal.

Everything below assumes a plain-text feed with no markup rendering. The character and line
figures are unofficial approximations reported by third parties; no platform documents them,
and they move with interface, font size and device width. Treat them as a target zone and
re-check them against current official guidance rather than encoding them as durable rules.

## The fold decides what the post is judged on

On LinkedIn the cut is modelled two ways at once and lands on whichever runs out first:

- a character budget of roughly 210 on desktop and 140 on mobile, and
- a budget of about three rendered lines.

**A blank line spends the line budget without spending characters.** A short opening on its
own line is therefore cut *earlier* than the same words inside a paragraph. Putting the hook
on its own line is usually still right, because it is what a scroller reads first, but it is
a trade rather than a free improvement.

## What the opening must do

- **Finish a complete thought above the cut.** An opening severed mid-sentence has spent the
  whole advertisement on half an idea.
- **Stay short on purpose.** A brief opening sentence is a hook doing its job. Do not rewrite
  one into a longer, smoother sentence for the sake of rhythm; that removes the
  advertisement. This is the most common way a well-meaning editing pass makes a post worse.
- **Earn the identifier before using it.** An opening that begins with a framework type or a
  product name asks a scroller to care about a word they have no reason to recognize yet.
  Name the friction first, then the mechanism.
- **Skip the throat-clearing.** The first line is the point, not a preamble to it.

Check the opening by reading only the first three lines and asking whether they are worth
expanding. If the answer depends on the fourth line, the opening is wrong.

## Sound like a person talking

A post that reads as generated gets scrolled past as generated, however accurate it is. The
fix is not a smoother sentence. It is writing the way someone who built the thing would
explain it to a colleague over coffee.

- **Open with something that happened.** What shipped, a real number, what you found this
  week. A concrete, checkable event reads as a person reporting. An aphorism about the domain
  ("A skill is just text…") reads as a slogan, however clever it is.
- **Talk, don't announce.** Contractions, a sentence that starts with "So" or "And", a
  parenthetical aside, a question answered straight away ("Why bother? Because…"). Use them
  the way speech does, now and then, not as a new pattern on every line.
- **Show the default, then the better way.** Name what the reader, or their coding agent,
  writes today in concrete terms, then the shape you are offering, with real identifiers. A
  before-and-after persuades; adjectives do not.
- **Sell with specifics.** Enthusiasm is welcome and a list of real capabilities is
  persuasive. What persuades is the command, the count, and the thing the reader can do
  tomorrow, not "powerful", "seamless" or "game-changing".
- **Say why in the words you would use out loud.** A reason with a stake ("we don't want the
  good version of that to be a paid add-on") beats a principle stated in the abstract.
- **Put a limit where it applies.** "On macOS and Linux, the installer…" carries the limit
  inside the claim. A closing paragraph labeled "One honest limit:" reads as a disclaimer a
  reviewer bolted on.
- **Keep the review out of the copy.** Evidence, verification and approval language belongs
  in the review record. A qualifier that protects the writer instead of informing the reader
  makes the post read as noncommittal. Keep every qualification that is true and would
  change what the reader does; drop the rest.
- **Stop when you are done.** A plain next step ("Links in the comments") ends a post better
  than a tidy closing maxim.

The tells to remove in review are listed in the **cratis-writing-voice-and-cadence** skill.

## Never use Unicode pseudo-formatting

Third-party tools offer pseudo-bold and pseudo-italic built from Mathematical Alphanumeric
Symbols — the characters that look like `𝗕𝗼𝗹𝗱` and `𝘐𝘵𝘢𝘭𝘪𝘤`. Do not use them.

- **Assistive technology cannot read them.** A screen-reader user hears "mathematical bold
  capital T, mathematical bold small h" through an entire line, or hears nothing at all.
- **They are not the letters they resemble.** Platform search and ranking index the actual
  code points, so a styled keyword is no longer that keyword and the term is lost.

Emphasis in a plain-text feed comes from sentence construction, line placement and what is
said first. A point that needs visual weight belongs in an image with its own alt text.

## Two things that cost reach outright

- **No external link in the body.** Current ranking suppresses posts that carry one; the
  convention is to put the link in a comment. Verify this at review rather than repeating it
  as folklore, and never write the convention into the copy itself.
- **No engagement bait.** "Repost if…", "Tag someone who…", "Agree?" are treated as spam
  signals rather than as engagement. A genuinely answerable question that follows from the
  argument is a different thing and is welcome.

## Structure that survives a phone

- One thread per post. A feed reader will not assemble two arguments. An announcement may
  still list what shipped as a plain list of short fragments inside that thread, with no
  bolded labels and no slogan per item.
- Short paragraphs, one to three sentences, and visibly different from each other in length.
  A column of identically sized blocks reads as a generated template before it reads as an
  argument.
- Blank lines separate paragraphs and nothing else. Each one costs line budget above the fold.
- No Markdown. The feed renders none of it, so `**bold**` and `# heading` reach the reader
  as literal characters.
- Hashtags on the last line only, never mid-sentence.
- Every image needs alt text. A post whose point lives only in an unlabeled image has no
  point for part of its audience.

## Before publishing

- The opening thought is complete above the fold on mobile as well as desktop.
- No pseudo-formatted characters anywhere, including the hook.
- No link in the body and no engagement bait in the close.
- Every image carries alt text, and the post still makes sense with the images removed.
- Every technical claim is one the underlying source actually supports, and any limitation
  the post depends on is stated rather than implied.

## Stop conditions

Stop and ask when the account owner, the author's perspective, the evidence behind a claim,
or an asset's permission is unresolved. Drafting a post is not authorization to publish,
schedule, tag, mention or upload it.

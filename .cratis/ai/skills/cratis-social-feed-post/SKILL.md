---
name: cratis-social-feed-post
description: Write or review a short post for a social feed such as LinkedIn, where the opening has to survive the feed's truncation, the body is plain text with no markup, media usually carries the post, every image, GIF, video and document carries the Cratis mark, and the common formatting tricks cost accessibility and reach. Use when drafting, adapting or reviewing a feed post, choosing its media, or adapting it for another channel. Do not use for documentation pages, release notes, long-form articles, or anything rendered as Markdown.
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

## Lead with media that explains

On LinkedIn, posts with media have higher observed engagement rates than text-only posts
for every format that has been measured. In Buffer's 2026 analysis the median engagement rate
was 21.77% for document carousels, 7.35% for video, 6.52% for images and 3.18% for text.
Socialinsider's Q2 2026 averages put multi-image (6.90%) and documents (6.60%) ahead of
video, images and text. These are engagement rates among each vendor's users. They aren't
reach, they don't prove cause, and neither study measures GIFs or infographics separately.
So on LinkedIn a post leads with at least one asset by default, and a text-only post is a
choice you make on purpose. On other channels the evidence differs (see below).

Pick the asset by what it has to explain:

- **Code card:** one mechanism a developer can read in a few seconds.
- **Several images:** every layer the opening names, such as a command and the event it
  returns. Don't split one idea into two posts to fit one image.
- **Document or carousel:** a sequence of steps, a before-and-after, or a decision walked
  through page by page. Documents and multi-image posts lead current LinkedIn engagement
  rates. Give it a cover that states the claim, and one idea per page.
- **GIF or screen recording:** an interaction where the motion is the point. Keep a static
  frame that makes sense on its own.
- **Video:** real behavior shown end to end, captioned, with a first frame and captions
  that work with the sound off.

A stock photo or a decorated title card isn't media in this sense. It explains nothing. The
first image is seen before the text is expanded, so it does the same job as the opening
line: one idea, legible on a phone.

## Brand every asset with the Cratis mark

Every image, card, document page, GIF, video and screenshot published for Cratis carries
the Cratis mark. There are no exceptions for small or quick assets. Media gets saved,
reposted and screenshotted away from its post, and the mark is what still says where it came
from.

- Use the real mark with the word "Cratis", unaltered: never stretched, cropped, outlined,
  animated, redrawn or recolored to another hue. Use white on a dark ground and near-black
  on a light one.
- Keep it at least 3% of the canvas width tall (36 px on a 1200 px canvas), with clear space
  about half its height and enough contrast to read on a phone.
- Place it by format:
  - **Card, image or infographic:** a brand row across the top.
  - **Document or carousel:** the full brand row on the cover, then the mark in the same
    place on every later page.
  - **GIF:** on every frame, because the feed can show any frame.
  - **Designed video:** a persistent corner mark for the whole length, in a place no
    player control or caption covers.
  - **Screenshot or screen recording:** framed, never stamped. The capture sits unchanged
    inside a branded frame with the brand row above it on every frame. Painting a logo
    over captured pixels alters what the capture shows. Give a light-theme capture a frame
    that keeps the mark readable.
- Keep the first frame informative. The persistent mark carries the brand, so a video or
  GIF doesn't need a branding-only title card, and its first frame should show the subject.
- Leave the logo out of alt text. Describe the idea in the image.
- Where an asset shows someone else's product or material, the mark belongs to the frame
  and must not suggest endorsement or partnership.

An asset without the mark isn't ready to publish. There's no evidence either way that a logo
changes organic reach. The mark is there for recognition and attribution.

## Links and bait

- **On LinkedIn, keep external links out of the body by default.** The sources reviewed
  don't establish that a body link lowers distribution, and "always put the link in the
  first comment" is folklore. We keep the link in a comment anyway, because the post has to
  stand on its own. Make an exception when the link is what the reader needs, such as the
  runnable sample the post is about. On channels where the link is the post, this doesn't
  apply. Never write the convention into the copy, and never present it as an algorithm
  fact.
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
- Hashtags on the last line only, never mid-sentence. No source supports a fixed count; one
  or two that name the subject are enough.
- Every image needs alt text. A post whose point lives only in an unlabeled image has no
  point for part of its audience.

## After publishing

Plan for the author to answer comments. In Buffer's data, LinkedIn accounts that replied to
comments had about 30% more engagement than their own posts without replies. That's
correlation within each account, not proof that replying causes it, but it costs nothing to
act on. Drafting a post never includes replying on someone's behalf.

## Other channels

A feed post adapted for another channel is rewritten for it, not cross-posted:

- **X and Bluesky:** shorter, one finding, and part of the conversation rather than a
  broadcast. Add an image when it explains something; text led engagement on X in 2025
  data.
- **Mastodon:** context and hashtags in the post, alt text on every image, and the
  server's own rules.
- **Reddit:** answer the question the community asked, with a reproducible example, say
  that you work on the project, and read that subreddit's current rules first.
- **Hacker News:** don't draft or edit anything posted there. HN's guidelines say "Don't
  post generated text or AI-edited text", so the title, text and comments must be written
  by a person. You may help that person collect facts, links and answers to check. Show HN
  is only for something people can try. Never ask anyone to upvote or comment.
- **dev.to, Hashnode and blogs:** the complete tested piece with versions and a canonical
  link, not a teaser.
- **YouTube:** a title and thumbnail that match what the video actually shows.

See [the engagement evidence](references/engagement-evidence.md) for sources, evidence grades
and the claims that are folklore.

## Before publishing

- The post leads with at least one asset that explains something, or text-only was chosen
  on purpose.
- Every image, document page, GIF frame and video carries the Cratis mark, and screenshots
  are framed rather than stamped.
- The opening thought is complete above the fold on mobile as well as desktop.
- No pseudo-formatted characters anywhere, including the hook.
- On LinkedIn, no link in the body unless the reader needs it there, and no engagement bait
  in the close.
- Every image carries alt text, and the post still makes sense with the images removed.
- Every technical claim is one the underlying source actually supports, and any limitation
  the post depends on is stated rather than implied.

## Stop conditions

Stop and ask when the account owner, the author's perspective, the evidence behind a claim,
an asset's permission or its branding is unresolved. Drafting a post is not authorization to
publish, schedule, tag, mention, upload or reply.

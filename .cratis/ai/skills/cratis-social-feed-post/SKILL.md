---
name: cratis-social-feed-post
description: Write or review a short post for a social feed such as LinkedIn, where only the opening shows before "see more", the body is plain text with no markup, posts lead with media that carries the Cratis mark, and formatting tricks cost accessibility. Use when drafting, adapting or reviewing a feed post, choosing its media, or adapting it for another channel. Do not use for documentation pages, release notes, long-form articles, or anything rendered as Markdown, and hand length, voice and distribution questions to their own skills.
license: MIT
---

# Social feed post

Someone scrolling a feed sees two or three lines of a post and its first image, and decides
there whether to read on. This skill covers what a post has to do inside that preview, what
media it leads with, and how it survives a phone screen and a screen reader.

Other skills own the neighboring questions. Use them instead of improvising here:

- How long the post should be: **cratis-content-length**.
- Whether it reads as written by a person: **cratis-writing-voice-and-cadence**.
- Where it goes, how often, and how to tell whether it worked: **cratis-developer-marketing**.
- The facts in a release or feature announcement: **cratis-release-notes**. This skill only
  adapts them for the feed.
- The code on a code card: **cratis-technical-examples**. A card links to the complete,
  versioned source and never stands in for it.

## What the platform actually says

LinkedIn described its current feed in March 2026. An LLM-based retrieval system feeds a
sequential ranking model, and the models learn from what members read, like, comment on,
return to and scroll past, with long dwells among the modeled actions. LinkedIn names those
signals and publishes no weights for them. It doesn't say whether expanding a particular post
counts for anything, so don't write as if it did.

Our editorial preference is one clear subject: one point per post. And whatever the ranking
does, a reader who doesn't expand the post never sees the rest of it.

LinkedIn has also said that AI may help with wording, but a post has to represent its
author's own voice and perspective. It says content that appears AI-generated and lacks a
clear perspective is less likely to be shown beyond the author's own network. That's
LinkedIn describing its own system, not an outside measurement, and it points the same way
as everything else here: the post needs an author with something to say.

The reviewed sources disclose no first-hour windows, hashtag counts, link penalties or save
weights. The folklore table in
[the engagement evidence](references/engagement-evidence.md) lists the common claims and what
the sources do and don't support.

## The preview decides what the post is judged on

Third-party tools report that LinkedIn shows roughly 210 characters on desktop and 140 on
mobile before "see more". LinkedIn doesn't publish these numbers. They are unofficial
approximations that move with the interface, font size and screen width, so check the real
preview on a phone before trusting any count.

Line wrapping and blank lines can change what fits in the preview. Check the actual mobile and
desktop rendering.

## What the opening must do

Finish a complete thought inside the preview. An opening cut off mid-sentence spends the whole
preview on half an idea.

Make it a specific proposition: what shipped, what broke, a number, the task the reader is
stuck on today. It has to be true. If the author didn't see it happen, it doesn't go in as
something they saw.

A brief opening sentence is a hook doing its job. Don't smooth it into a longer, rounder
sentence during an edit. Avoid lengthening an opening if that makes its thought disappear
below the preview.

Name the problem before the identifier. A type name or product name in the first line asks a
scroller to care about a word they have no reason to know yet.

Then test it. Read only the preview and ask whether you'd expand it. If the answer depends on
the line after the cut, rewrite the opening.

## Lead with media on LinkedIn

On LinkedIn, a Cratis post leads with at least one asset by default. Text-only is allowed,
and sometimes it's the right vehicle for one sharp point. It is a decision made on purpose and
noted with the draft, not what happens because nobody made an image.

This is Cratis's editorial default and an open hypothesis that Cratis is measuring. It isn't a
proven effect. The vendor datasets behind it, Buffer's medians and Socialinsider's
business-page averages, show higher engagement rates for documents, multi-image posts and
video than for text. They are observational. They measure engagement, not reach. Neither
dataset reports GIFs separately. [The SEO Works](https://www.seoworks.co.uk/downloads/data-led-analysis-of-linkedin-video-vs-carousels/)
reports counting slide-advance clicks in its own carousel engagement calculation; this does
not establish Buffer's or Socialinsider's calculation. The
figures and their caveats are in the evidence reference.

Choose the asset by what it has to explain. A code card suits one mechanism a developer can
read in a few seconds. Use several images when the opening names several layers, such as a
command and the event it produces; don't split one idea across two posts to fit one image. A
document suits a sequence, like steps, a before-and-after or a decision walked through page by
page, with the claim on the cover and one idea on each page. Use a GIF or screen recording
when the motion is the point, and make sure its first frame makes sense on its own. Video is
for real behavior shown end to end, captioned so it works with the sound off.

A stock photo or a decorated title card explains nothing, so it doesn't count. The first image
is seen before the text is expanded and does the same job as the opening line: one idea,
readable on a phone.

Every image needs alt text that carries its idea, and the post should still make sense with
the images removed.

## Brand every asset with the Cratis mark

Every image, card, document page, GIF, video and screenshot Cratis publishes carries the
Cratis mark. The reason is attribution. Media gets saved and reshared away from its post, and
the mark is what still says where it came from. The reviewed evidence establishes no logo
effect on organic reach, and this rule doesn't claim one.

- Use the real mark, unaltered: not stretched, cropped, recolored, redrawn or animated.
- Make it large enough, with enough contrast, to read on a phone.
- Place it for the format: a brand row on a card or image; on a document's cover and in the
  same spot on every page after it; on every frame of a GIF, because the feed can show any
  frame; as a persistent corner mark on designed video, clear of player controls and captions.
- Screenshots and screen recordings are framed, never stamped. The capture sits unchanged
  inside a branded frame, because painting a logo over captured pixels changes what the
  capture shows.
- Leave the logo out of alt text. Describe the idea in the image.

An asset without the mark isn't ready to publish.

## Never use Unicode pseudo-formatting

The feed renders no Markdown, so `**bold**` and `# heading` arrive as literal characters.
Third-party tools offer a workaround: "bold" and "italic" letters built from Mathematical
Alphanumeric Symbols, the characters that look like `𝗕𝗼𝗹𝗱` and `𝘐𝘵𝘢𝘭𝘪𝘤`. Don't use them.

Assistive technology cannot read them reliably. A screen reader may spell out "mathematical
bold capital T" letter by letter, or skip the word. They use different code points from
ordinary letters; search behavior depends on the platform's normalization.

Emphasis in a plain-text feed comes from what you say first and where the lines break. A point
that needs visual weight belongs in an image with its own alt text.

Keep to one thread per post. An announcement can still list what shipped as short, plain
fragments inside that thread. Blank lines separate paragraphs and do nothing else, since each
one uses preview space. Hashtags go on the last line, never mid-sentence. No source supports a
particular count; our default is one or two that name the subject.

## Links and bait

On LinkedIn, keep external links out of the body by default. That's an editorial default, not
a platform rule. The sources reviewed don't show that a body link lowers distribution, and
"always put the link in the first comment" is folklore. We do it because a post should be
worth reading without the click. When the link is what the reader needs, such as the runnable
sample the post is about, it goes in the body. On channels where the link is the post, none
of this applies. Don't explain the placement inside the post, and never present it as an
algorithm fact.

No engagement bait: "Repost if…", "Tag someone who…", "Agree?". A question that follows from
the argument, and that the author actually wants answered, is a different thing and welcome.

## Length

How long a post should be depends on its job. Work that out with **cratis-content-length**
rather than a rule of thumb from here.

Feed posts should vary. A short post that makes one point and a longer worked example both
belong in the same feed, and a feed where every post is the same length reads as a template
before anyone reads the words. The one large LinkedIn length dataset covers personal profiles
and is correlational, so it's no reason to pad a company post. Hard platform limits are listed
in the evidence reference.

## Voice

Run the voice review with **cratis-writing-voice-and-cadence**. It has the constructions to
cut, the checks for sameness across posts, and the rule that no rewrite may change a claim.

The feed-specific part is whose voice it is. A post goes out under a named person or a team,
so the perspective and any first-hand account have to be theirs, and they review it before
it's ready.

## After publishing

Plan for the author to answer comments. In Buffer's data, LinkedIn posts where the account
replied to comments had about 30% more engagement than that same account's posts without
replies. Buffer says itself that this doesn't show replies cause it. Replies take the author's
time, so count that time when planning a post.

An agent never replies on anyone's behalf. It can draft an answer for the author to rewrite
and send.

Where posts go, how often, and how to measure what happened belongs to
**cratis-developer-marketing**.

## Other channels

A post adapted for another channel is rewritten for it, not cross-posted. Read each
channel's current rules before posting.

- X, Bluesky and Mastodon want something shorter: one finding, offered as part of a
  conversation rather than a broadcast. Their limits are counted differently (weighted
  characters on X, graphemes on Bluesky, and a Mastodon default each server can change), so
  check the evidence reference. On Mastodon, put context and hashtags in the post and alt
  text on every image.
- On Reddit, answer the question the community asked, with a reproducible example, and say
  that you work on the project. Read that subreddit's rules first.
- On Hacker News, AI doesn't write or edit anything Cratis posts: not the title, not the
  text, not a comment. HN's guidelines prohibit generated or AI-edited text in comments.
  Extending that to everything Cratis submits is Cratis's own stricter policy, not something
  the guidelines say. You may help a person gather facts, links and answers for them to check.
  HN also asks for the original source and, usually, the original title, asks that the site
  not be used mainly for promotion, and prohibits asking for upvotes or comments.
- On dev.to, Hashnode or a blog, post the complete tested piece with versions and a canonical
  link, not a teaser.
- On YouTube, use a title and thumbnail that match what the video shows.

## Before publishing

- On LinkedIn, the post leads with at least one asset that explains something, or text-only
  was chosen on purpose and noted.
- Every image, document page, GIF frame and video carries the Cratis mark, and screenshots
  are framed rather than stamped.
- The opening thought is complete inside the preview on mobile as well as desktop.
- No Markdown and no pseudo-formatted characters anywhere, including the hook.
- On LinkedIn, no link in the body unless the reader needs it there, and no engagement bait.
- Every image has alt text, and the post makes sense with the images removed.
- Every technical claim is one the underlying source supports, and any limitation the post
  depends on is stated rather than implied.
- The named author has reviewed the perspective the post speaks in.

## Stop conditions

Nothing is ever published, scheduled or replied to by an agent. Drafting a post doesn't
authorize publishing, scheduling, tagging, mentioning, uploading or replying.

Stop and ask when the account owner, the author's perspective, the evidence behind a claim,
an asset's permission or its branding is unresolved.

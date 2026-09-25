# Engagement evidence for feed posts

This is the public evidence behind the feed post skill, as of 2026-09-25. Each row states the
claim the way the source supports it, which is often narrower than the way it gets repeated.
Platforms change their ranking and formats often, so recheck the sources before relying on a
row and correct this file when they change.

**Grades**

- **Official**: the platform describing its own system or publishing its own rules. Good
  evidence of what the platform says. It doesn't show that a tactic works.
- **Vendor, observational**: data a tool vendor collected from its own customers. It shows
  correlation within that population. It isn't causal, and it isn't the whole platform.
- **Third-party guidance**: a vendor's description or advice, not a measurement and not an
  official specification.

**Verification** records what happened when each claim was checked against its source by
quote. *Confirmed* means the source says what the row says. *Partly confirmed* means the row
has been narrowed to what the source supports. *Checked against source* marks figures read
directly off the source page outside the quote-level review.

## LinkedIn: what the platform says

| Claim as supported | Source | Date | Population / metric | Grade | Verification |
| --- | --- | --- | --- | --- | --- |
| LinkedIn is rolling out an LLM- and GPU-powered feed ranking system. The article gives no scoring formula for creators. | [LinkedIn Engineering](https://www.linkedin.com/blog/engineering/feed/engineering-the-next-generation-of-linkedins-feed) | 2026-03-12 | System description; no outcome metric | Official | Confirmed |
| The architecture couples unified LLM-based retrieval with a sequential ranking model. | Same article | 2026-03-12 | System description | Official | Confirmed |
| The models use profile context and each member's history of what they read, liked, commented on, returned to or scrolled past. | Same article | 2026-03-12 | Model inputs; relative weights undisclosed | Official | Confirmed |
| A post's representation includes its format, author information, engagement counts, article metadata and text. | Same article | 2026-03-12 | Model inputs; relative weights undisclosed | Official | Confirmed |
| LLM embeddings let members discover posts beyond keyword matches, including from authors they don't follow. This describes retrieval, not guaranteed reach. | Same article | 2026-03-12 | System description | Official | Confirmed |
| Long dwells, likes, comments and shares are among the actions the ranking model embeds. No relative weights are given. | Same article | 2026-03-12 | Model inputs; relative weights undisclosed | Official | Confirmed |
| New posts get embeddings in near real time, and embeddings for posts gaining engagement are refreshed. The article sets no one-hour cutoff; that doesn't prove no timing effect exists. | Same article | 2026-03-12 | System description | Official | Confirmed |
| AI may help with writing, but posts and comments should represent the member's own voice and perspectives. | [LinkedIn: Keeping conversations real](https://news.linkedin.com/2026/keeping-conversations-real-on-linkedin) | 2026-06-04 | Policy statement | Official | Confirmed |
| Content that appears AI-generated and lacks a clear perspective is less likely to be distributed beyond the author's immediate network. This is LinkedIn's own account, not independently measured, and not a ban on AI assistance. | Same statement | 2026-06-04 | Policy statement | Official | Confirmed |

What these rows don't tell you: whether expanding "see more" on a given post is itself a
ranking signal, how any signal is weighted, or how long a post should be.

## LinkedIn: format engagement

| Claim as supported | Source | Date | Population / metric | Grade | Verification |
| --- | --- | --- | --- | --- | --- |
| Buffer analyzed over 52 million posts across 10 platforms. Its figures describe Buffer-posted content only, and Buffer says it isn't a full-platform view. | [Buffer, State of social media engagement 2026](https://buffer.com/resources/state-of-social-media-engagement-2026/) | 2026-03-05 | Buffer customers' posts | Vendor, observational | Confirmed |
| Document (PDF carousel) posts had a median engagement rate of 21.77%. | Same report | 2026-03-05 | Median engagement rate, LinkedIn, Buffer sample | Vendor, observational | Confirmed |
| Video had a median engagement rate of 7.35% and images 6.52%. | Same report | 2026-03-05 | Median engagement rate, LinkedIn, Buffer sample | Vendor, observational | Confirmed |
| Link posts had a median engagement rate of 3.81% and text posts 3.18%. This compares formats; it does not test a link in the body against a link in a comment. | Same report | 2026-03-05 | Median engagement rate, LinkedIn, Buffer sample | Vendor, observational | Confirmed |
| Socialinsider's LinkedIn benchmark is built from business pages: 1.3 million posts from 16,645 active pages, January 2024 to December 2025. Different population from personal profiles. | [Socialinsider LinkedIn benchmarks](https://www.socialinsider.io/social-media-benchmarks/linkedin) | Page metadata 2026-03-16 | Business pages | Vendor, observational | Confirmed |
| In Q2 2026, average engagement rates were: multi-image 6.90%, documents 6.60%, video 5.90%, images 5.20%, text 3.95%. | Same page | Q2 2026 | Average engagement rate. Business pages; Q2 sample size and methodology not established by the cited 2024–2025 population. | Vendor, observational | Checked against source |
| Documents led 2025 with a 7.00% average engagement rate. | Same page | 2025 | Average engagement rate, business pages | Vendor, observational | Checked against source |
| For pages with up to 50K followers, multi-image posts had the most impressions per post. This is the only reach finding in this table. | Same page | Live | Impressions per post, pages up to 50K followers | Vendor, observational | Checked against source |
| The SEO Works reports counting slide-advance clicks in its own carousel engagement calculation; this does not establish Buffer's or Socialinsider's calculation. Not an official LinkedIn metric definition. | [The SEO Works, LinkedIn video vs carousels](https://www.seoworks.co.uk/downloads/data-led-analysis-of-linkedin-video-vs-carousels/) | 2025 sample | One agency's own LinkedIn channel; measurement method | Third-party guidance | Confirmed |

Neither dataset reports GIFs or infographics separately. Engagement rate is not reach. The
SEO Works reports counting slide-advance clicks in its own carousel engagement calculation;
this does not establish Buffer's or Socialinsider's calculation. Buffer reports medians and
Socialinsider averages, over different populations, so don't put their numbers side by side
as if they measured the same thing.

## LinkedIn: replies and frequency

| Claim as supported | Source | Date | Population / metric | Grade | Verification |
| --- | --- | --- | --- | --- | --- |
| Buffer's reply analysis covered nearly 2 million posts from more than 220,000 accounts on six platforms, comparing each account with itself. | [Buffer, State of social media engagement 2026](https://buffer.com/resources/state-of-social-media-engagement-2026/) | 2026-03-05 | Within-account comparison, Buffer sample | Vendor, observational | Confirmed |
| LinkedIn posts where the account replied to comments had about 30% more engagement than the same account's posts without replies. Buffer says this doesn't mean replies cause it. | Same report | 2026-03-05 | Within-account engagement difference | Vendor, observational | Confirmed |
| Buffer's LinkedIn frequency analysis covered over 2 million posts from more than 94,000 accounts. The page title says 2026; the page shows a publication date of 2025-08-28. | [Buffer, How often to post on LinkedIn](https://buffer.com/resources/how-often-to-post-on-linkedin/) | 2025-08-28 | Buffer customers' LinkedIn accounts | Vendor, observational | Confirmed (date partly confirmed) |
| Posting 2 to 5 times a week was associated with 1,182 more impressions per post and a 0.23 percentage-point higher engagement rate than posting once a week. Not causal, and not a minimum anyone must meet. | Same article | 2025-08-28 | Within-account impressions and engagement rate | Vendor, observational | Confirmed |

## Length and the preview

| Claim as supported | Source | Date | Population / metric | Grade | Verification |
| --- | --- | --- | --- | --- | --- |
| In 372,126 personal-profile posts (September 2025 to February 2026), posts of 1,301 to 2,500 characters had 27% higher engagement than posts under 400. Not a company-page result and not causal. | [AuthoredUp, LinkedIn character limit](https://authoredup.com/blog/linkedin-character-limit) | 2026-04-02, updated 2026-08-11 | Engagement rate by character band, personal profiles | Vendor, observational | Confirmed |
| Median engagement by band: 2.10% at 1 to 400 characters, 2.61% at 1,301 to 2,000, 2.67% at 2,001 to 2,500, 2.62% at 2,501 to 3,000. The curve isn't monotonic. Cite the table; an interactive graphic on the same page shows 2.63% for the last band. | Same page | 2026-08 update | Median engagement rate, personal profiles | Vendor, observational | Confirmed |
| AuthoredUp, not LinkedIn, reports a 3,000-character post limit and a preview of roughly 210 characters on desktop and 140 on mobile before "see more". These are approximations that depend on the interface. | Same page | 2026-08 update | Interface description | Third-party guidance | Confirmed |

## Platform limits

| Claim as supported | Source | Date | Population / metric | Grade | Verification |
| --- | --- | --- | --- | --- | --- |
| Bluesky's post schema limits text to 300 graphemes and 3,000 UTF-8 bytes. | [AT Protocol post lexicon](https://raw.githubusercontent.com/bluesky-social/atproto/main/lexicons/app/bsky/feed/post.json), units per [lexicon spec](https://atproto.com/specs/lexicon) | Live, unpinned | Hard limit | Official | Confirmed |
| Mastodon's default limit is 500 characters. Instances can change it. | [Mastodon posting guide](https://docs.joinmastodon.org/user/posting/) | Live | Default limit | Official | Confirmed |
| An ordinary X post can hold 280 weighted characters; emoji, URLs and some Unicode ranges count differently. The page doesn't cover paid longer posts. | [X character counting](https://docs.x.com/fundamentals/counting-characters) | Live | Hard limit, weighted | Official | Confirmed |

## Hacker News

| Claim as supported | Source | Date | Population / metric | Grade | Verification |
| --- | --- | --- | --- | --- | --- |
| Submit the original source, and generally the original title unless it's misleading or linkbait. | [HN guidelines](https://news.ycombinator.com/newsguidelines.html) | Live | Site rule | Official | Confirmed |
| Posting your own work part of the time is fine; using HN primarily for promotion is not. | Same page | Live | Site rule | Official | Confirmed |
| Don't solicit upvotes, comments or submissions. | Same page | Live | Site rule | Official | Confirmed |
| "Don't post generated text or AI-edited text. HN is for conversation between humans." The rule sits under "In Comments"; the guidelines don't state it for submissions. | Same page | Live | Site rule | Official | Confirmed |

Cratis applies the comment rule to everything it posts on HN, submissions included. That is
Cratis's own stricter policy, not a reading of the guidelines.

## Not verified, removed from guidance

These appeared in earlier drafts or are commonly quoted. They weren't confirmed in the review
behind this file, so the skill doesn't rely on them. Check the live source before using any
of them.

- Buffer's "about 83% of profiles performed better when they replied" (same report as above).
- Buffer's best-time-to-post windows for LinkedIn.
- Buffer's statement that text led engagement on X in 2025.
- A Socialinsider sentence that documents and multi-image posts have "consistently
  outperformed" other formats. The quarterly and yearly figures above were checked; the
  sentence was not.
- LinkedIn Help's image aspect ratios, and the claim that its 1.91:1 figure applies only to
  link previews and ads.
- The Show HN page's description of what qualifies.
- Quoted rules from Bluesky's community guidelines, Reddit's rules, Hashnode's code of conduct,
  YouTube Help on thumbnails, and Google Search Central on AI features. The advice to read each
  channel's current rules stands; the quotes were not rechecked.

## Accessibility references

These are standards cited directly, not engagement evidence.

- Alt text for images that carry information:
  [W3C images decision tree](https://www.w3.org/WAI/tutorials/images/decision-tree/).
- Captions for video: [W3C captions](https://www.w3.org/WAI/media/av/captions/).
- Contrast of 4.5:1 for normal text and 3:1 for large text:
  [WCAG 2.1 contrast minimum](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html).

## Folklore

| Claim | Status | Best source |
| --- | --- | --- |
| "LinkedIn suppresses posts with an external link; always put it in the first comment." | Not established. The format figures compare link posts with other formats, not link placement. Keeping links out of the body is an editorial default, with an exception when the reader needs the link. | [Buffer](https://buffer.com/resources/state-of-social-media-engagement-2026/) |
| "Expanding 'see more' is a ranking signal." | Not disclosed. LinkedIn models reading, dwell and return behavior and publishes no weights; it says nothing about expansion of a single post. | [LinkedIn Engineering](https://www.linkedin.com/blog/engineering/feed/engineering-the-next-generation-of-linkedins-feed) |
| "The first 60 to 90 minutes decide a post's life." | No fixed window is published. LinkedIn describes refreshing embeddings for posts gaining engagement, and names no cutoff. | [LinkedIn Engineering](https://www.linkedin.com/blog/engineering/feed/engineering-the-next-generation-of-linkedins-feed) |
| "Saves outrank likes", "use exactly N hashtags", "matching profile keywords unlocks reach." | No weights or counts are published. | [LinkedIn Engineering](https://www.linkedin.com/blog/engineering/feed/engineering-the-next-generation-of-linkedins-feed) |
| "Carousels always get more reach" / "video is always favored." | Unsupported. The document figures are engagement rates, not reach. The SEO Works reports counting slide-advance clicks in its own carousel engagement calculation; this does not establish Buffer's or Socialinsider's calculation. The one impressions finding favors multi-image posts, and only for pages up to 50K followers. | [Buffer](https://buffer.com/resources/state-of-social-media-engagement-2026/), [Socialinsider](https://www.socialinsider.io/social-media-benchmarks/linkedin), [The SEO Works](https://www.seoworks.co.uk/downloads/data-led-analysis-of-linkedin-video-vs-carousels/) |
| "Everyone should post 2 to 5 times a week." | An observational association, not a prescription. Capacity and audience differ. | [Buffer](https://buffer.com/resources/how-often-to-post-on-linkedin/) |
| "Every post must be short" / "1,300 to 2,500 characters wins the algorithm." | Both unsupported. The longer-band result is personal-profile only and correlational. | [AuthoredUp](https://authoredup.com/blog/linkedin-character-limit) |
| "Using AI to write a post kills its reach." | Overbroad. LinkedIn's statement pairs apparent AI generation with a lack of clear perspective, and allows AI help with wording. | [LinkedIn](https://news.linkedin.com/2026/keeping-conversations-real-on-linkedin) |
| "HN is a place for polished promotional replies." | Contradicted. HN prohibits generated or AI-edited comments and says the site shouldn't be used primarily for promotion. | [HN guidelines](https://news.ycombinator.com/newsguidelines.html) |
| "A logo hurts reach" / "a logo guarantees recall." | Neither has been shown for organic developer content. The Cratis mark is an attribution rule, not a growth claim. | None found |

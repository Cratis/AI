# Engagement evidence

What the evidence says about engagement for developer content on social channels, as of
2026-09-25, and how strong each point is. Platforms change their ranking and formats often,
so check the sources again at review and correct this file when they change.

- **Official:** the platform, a standards body, or its published rules describing its own
  system. This is strong evidence of how the system works. It doesn't prove that a tactic
  helps.
- **Large-sample study:** observational data published by a vendor. It shows correlation
  among that vendor's users, not causation and not the whole platform.
- **Folklore:** widely repeated, with no source that tests it.

## LinkedIn

- **Ranking.** LinkedIn's March 2026 system uses LLM-based retrieval and a sequential ranking
  model. It learns from what members "read, liked, commented on, returned back to, or simply
  scrolled past", and from actions such as long dwells, likes, comments and shares. It
  matches posts to a member's interests even outside their network.
  [LinkedIn Engineering, 2026-03-12](https://www.linkedin.com/blog/engineering/feed/engineering-the-next-generation-of-linkedins-feed).
  Official. LinkedIn publishes these signals but not their weights, so a post that says one
  clear thing about one subject is easier to match than one that says everything.
- **Formats.** Median engagement rates were 21.77% for document carousels, 7.35% for video,
  6.52% for images, 3.81% for link posts and 3.18% for text.
  [Buffer, 2026-03-05](https://buffer.com/resources/state-of-social-media-engagement-2026/).
  Large-sample study of Buffer users (medians, data through December 2025). LinkedIn's
  engagement rate includes clicks. A second dataset of 1.3M business-page posts reports
  averages: documents led 2025 at 7.00%, and in Q2 2026 multi-image posts had 6.90%, documents
  6.60%, video 5.90%, images 5.20% and text 3.95%. "Native documents and multi-image posts
  have consistently outperformed" other formats. For pages with up to 50K followers,
  multi-image posts had the most impressions per post, the only reach finding here.
  [Socialinsider, 2026](https://www.socialinsider.io/social-media-benchmarks/linkedin).
  Large-sample study. Neither study separates GIFs or infographics from other formats.
- **Replies.** Within the same account, LinkedIn posts where the account replied to comments
  had about 30% more engagement, and about 83% of profiles did better when they replied.
  Buffer, same report. Large-sample study using a within-account model. Buffer says this
  doesn't prove replies cause it.
- **Timing and frequency.** Buffer found "no single 'best time to post' or magic number of
  posts per week". Accounts that skipped a week underperformed their own baseline.
  Large-sample study.
- **Specifications.** Check the current limits for the exact upload type in the composer or
  LinkedIn Help. The 1.91:1 figure in
  [LinkedIn Help](https://www.linkedin.com/help/linkedin/answer/a521928) is for link previews
  and ads, not organic posts.

## Other channels

| Channel | What the rules say | Source |
| --- | --- | --- |
| X | Text led engagement in 2025, and the median engagement rate for non-Premium accounts fell sharply. That's engagement, not reach. | Buffer, same report. Large-sample study. |
| Bluesky | "Do not send spam or repeatedly post content in ways that disrupt normal conversations" | [Community guidelines, 2025-09-19](https://bsky.social/about/support/community-guidelines). Official. |
| Mastodon | Posts support hashtags, visibility settings, content warnings and alt text, and each server has its own rules | [Posting guide](https://docs.joinmastodon.org/user/posting/). Official. |
| Reddit | Follow each community's rules and "participate authentically" | [Reddit Rules](https://redditinc.com/policies/reddit-rules). Official. |
| Hacker News | "Don't post generated text or AI-edited text. HN is for conversation between humans." Show HN is for "something you've made that other people can play with". "Please don't ask friends to upvote or comment." "Please don't use HN primarily for promotion." | [Show HN](https://news.ycombinator.com/showhn.html) and [guidelines](https://news.ycombinator.com/newsguidelines.html). Official. |
| Hashnode | Welcomes technical posts and tutorials, and forbids "engagement farming, misleading links, or bulk automated content" | [Code of conduct, 2026-06-04](https://hashnode.com/code-of-conduct). Official. |
| YouTube | Recommendations follow what viewers watch and don't watch. "Deceiving, misleading, clickbaity or sensational" thumbnails are against policy. | [YouTube Help](https://support.google.com/youtube/answer/141805). Official. |
| Search and answer engines | Ordinary SEO practice "remain[s] relevant for AI features", with "no additional requirements" | [Google Search Central](https://developers.google.com/search/docs/appearance/ai-features). Official. |

## Accessibility

- Alt text for images that carry information:
  [W3C images decision tree](https://www.w3.org/WAI/tutorials/images/decision-tree/).
- Captions for video: [W3C captions](https://www.w3.org/WAI/media/av/captions/).
- Text contrast of 4.5:1 for normal text and 3:1 for large text:
  [WCAG 2.1 contrast minimum](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html).

## Folklore

| Claim | Status |
| --- | --- |
| "LinkedIn suppresses posts with an external link; always put it in the first comment" | Not established by the sources reviewed. The link-post figures compare formats, not where the link is placed. |
| "Post at 8 a.m. on Tuesday" / "the first hour decides everything" | Unsupported as a universal rule |
| "Use 3–5 hashtags" | No source tests any count |
| "Carousels always get more reach" / "video is always favored" | The carousel figures are engagement rates, not reach. The one impressions finding favors multi-image posts for smaller pages. |
| "360Brew ranks saves above likes" / "matching profile keywords unlocks reach" | LinkedIn publishes signals, not weights. See the [360Brew paper, 2025](https://arxiv.org/abs/2501.16450). |
| "A logo hurts reach" / "a logo guarantees recall" | Neither has been shown for organic developer content |

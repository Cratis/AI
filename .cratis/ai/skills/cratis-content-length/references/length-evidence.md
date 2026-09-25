# Length evidence

The sources behind the bands in the content length skill, as of 2026-09-25. Every entry was
checked against its source page; where the original reading overstated a source, the
corrected reading is the one given here. Platform limits and vendor figures change, so check
the live page before relying on a number and correct this file when it moves.

Grades describe the kind of source, not how certain the number is:

- **Official:** the platform's own documentation, specification or rules. Strong evidence of
  how the platform works. It doesn't show that a tactic helps.
- **Vendor:** an observational study published by a tool vendor about its own users' posts.
  It shows an association in that population. It doesn't show cause, and it doesn't cover the
  whole platform.
- **Small study:** one channel or a small sample, with topic and creative uncontrolled.
- **Survey:** what respondents said about themselves, with the survey's own recruitment bias.
- **Practitioner:** guidance or a worked case from a company or practitioner. Good for ideas,
  not for numbers.

## LinkedIn text

| ID | Finding | Population and method | Date | Grade | Source |
| --- | --- | --- | --- | --- | --- |
| LM-01 | Posts of 1,301–2,500 characters had about 27% higher engagement than posts under 400 characters. Not causal, and not a company-page result. | 372,126 personal-profile posts with at least one impression, September 2025 to February 2026 | Published 2026-04-02, updated 2026-08-11 | Vendor | [AuthoredUp](https://authoredup.com/blog/linkedin-character-limit) |
| LM-02 | Median engagement by length band: 2.10% at 1–400 characters, 2.24% at 401–700, 2.31% at 701–1,000, 2.44% at 1,001–1,300, 2.61% at 1,301–2,000, 2.67% at 2,001–2,500, 2.62% at 2,501–3,000. The curve is not monotonic. Cite the table; an interactive graphic on the same page shows 2.63% for the last band. | Same sample as LM-01 | 2026-08-11 update | Vendor | [AuthoredUp](https://authoredup.com/blog/linkedin-character-limit) |
| LM-03 | A 3,000-character post limit "including spaces, emojis, and line breaks", and roughly 210 desktop or 140 mobile characters visible before "see more". These are third-party figures, not a LinkedIn specification, and the visible count varies by device. | Vendor documentation | 2026-08-11 update | Practitioner | [AuthoredUp](https://authoredup.com/blog/linkedin-character-limit) |
| LM-06 | Socialinsider's LinkedIn benchmark covers business pages, a different population from the personal profiles in LM-01. | 1.3 million posts from 16,645 active business pages, January 2024 to December 2025 | 2026-03-16 | Vendor | [Socialinsider](https://www.socialinsider.io/social-media-benchmarks/linkedin) |
| LM-08 | LinkedIn's ranking uses what members have "read, liked, commented on, returned back to, or simply scrolled past". The article names no rewarded post length. That silence doesn't prove length never matters. | Engineering description of the feed system | 2026-03-12 | Official | [LinkedIn Engineering](https://www.linkedin.com/blog/engineering/feed/engineering-the-next-generation-of-linkedins-feed) |
| LI-11 | Median engagement was 3.81% for link posts and 3.18% for text posts. This compares formats. It doesn't compare a link in the body with a link in a comment. | Buffer's sample of over 52 million posts across ten platforms | 2026-03-05 | Vendor | [Buffer](https://buffer.com/resources/state-of-social-media-engagement-2026/) |

## LinkedIn documents

| ID | Finding | Population and method | Date | Grade | Source |
| --- | --- | --- | --- | --- | --- |
| LM-04 | Median LinkedIn engagement by format: 21.77% for document carousels, 7.35% video, 6.52% images, 3.81% link posts, 3.18% text. These are format medians, not length effects, and not causal. | Over 52 million posts across ten platforms, posted through Buffer | 2026-03-05 | Vendor | [Buffer](https://buffer.com/resources/state-of-social-media-engagement-2026/) |
| LM-09 | An agency's analysis of its own LinkedIn channel. Useful as an example of a local experiment, not a platform rule. | 114 carousel and video posts from one account, January to December 2025 | 2025 data; page date not stated | Small study | [The SEO Works](https://www.seoworks.co.uk/downloads/data-led-analysis-of-linkedin-video-vs-carousels/) |
| LM-10 | Average carousel engagement by page count: 53.6% at 7–9 pages, 50.4% at 4–6, 45.5% at 10 or more, 36.9% at 3 or fewer. Topic and design are not controlled, and the article's cognitive-load explanation is not tested by the table. | Same sample as LM-09 | 2025 data | Small study | [The SEO Works](https://www.seoworks.co.uk/downloads/data-led-analysis-of-linkedin-video-vs-carousels/) |
| LM-11 | The agency counts clicks to advance pages in its carousel engagement rate. A high rate therefore doesn't show that anyone understood or acted on the content. | Measurement description in the same article | 2025 data | Small study | [The SEO Works](https://www.seoworks.co.uk/downloads/data-led-analysis-of-linkedin-video-vs-carousels/) |
| LM-12 | Socialinsider suggests 8–12 pages with one idea per page, and lists a 300-page maximum for organic document posts against 2–10 cards for paid carousel ads. Third-party guidance, not a LinkedIn specification. An upload maximum is not an editorial target. | Vendor guide | 2026-08-31 | Practitioner | [Socialinsider](https://www.socialinsider.io/blog/linkedin-carousel/) |

## Other feeds

| ID | Finding | Date | Grade | Source |
| --- | --- | --- | --- | --- |
| LM-13 | Bluesky post text is limited to 300 graphemes and 3,000 bytes. The lexicon specification defines these as Unicode grapheme clusters and UTF-8 bytes. The linked file is on the main branch and not pinned to a revision. | Live, accessed 2026-09 | Official | [AT Protocol post lexicon](https://raw.githubusercontent.com/bluesky-social/atproto/main/lexicons/app/bsky/feed/post.json), [lexicon specification](https://atproto.com/specs/lexicon) |
| LM-14 | Mastodon's documented limit is 500 characters by default. Individual instances can differ. | Live, accessed 2026-09 | Official | [Mastodon posting guide](https://docs.joinmastodon.org/user/posting/) |
| LM-15 | X ordinary posts are limited to 280 weighted characters, with special counting for emoji, URLs and some Unicode ranges. The page doesn't cover paid longer-post features. | Live, accessed 2026-09 | Official | [X counting characters](https://docs.x.com/fundamentals/counting-characters) |

## Video

| ID | Finding | Population and method | Date | Grade | Source |
| --- | --- | --- | --- | --- | --- |
| LM-17 | Wistia's 2026 analysis combines a survey of more than 900 professionals with more than 13 million videos and 79 million viewing hours on Wistia. It is hosted video, not a sample of social feed video. | Survey plus hosted-video data | 2026-04-22 | Vendor | [Wistia statistics](https://wistia.com/learn/marketing/video-marketing-statistics) |
| LM-18 | Wistia suggests under one minute for awareness and social use. Videos under a minute averaged 52% engagement, which Wistia explains as viewers typically watching about half the length. It is not a 52% completion rate. | Wistia-hosted videos | Article dated 2025-07-01, revised for the 2026 report | Vendor | [Wistia video length](https://wistia.com/learn/marketing/optimal-video-length) |
| LM-19 | Wistia suggests 1–5 minutes for education and explanation, including product demos, and says viewers typically watch over half of educational and tutorial videos in that range. | Wistia-hosted videos | Same | Vendor | [Wistia video length](https://wistia.com/learn/marketing/optimal-video-length) |
| LM-20 | Wistia suggests 5–30 minutes for motivated viewers in conversion and nurture contexts and reports a 9% average click-through rate in that band. Longer duration isn't shown to cause the clicks. | Wistia-hosted videos | Same | Vendor | [Wistia video length](https://wistia.com/learn/marketing/optimal-video-length) |

## Articles, tutorials and release notes

None of these sources measures length. They support the reasoning in the skill, not its
numbers, which is why those rows are marked weak.

| ID | Finding | Date | Grade | Source |
| --- | --- | --- | --- | --- |
| DP-03 | PostHog tells writers to decide who a post is for and how it will reach them before writing, and contrasts fast, spiky social traffic with slow, compounding search traffic. | Living handbook | Practitioner | [PostHog blog handbook](https://posthog.com/handbook/content/blogs) |
| DP-17 | Vercel's engineering article walks through production experiments and reports a 91% reduction in P99 metadata lookup latency. That figure is for metadata lookup, not overall CDN latency. | 2026-09-10 | Practitioner (case) | [Vercel](https://vercel.com/blog/how-we-cut-cdn-metadata-lookup-latency-by-91-percent) |
| DM-03 | In the 2025 Stack Overflow survey, technical documentation was the most used learning resource in the past year, at nearly 68% of respondents. The survey recruits mainly through Stack Overflow's own channels. | 2025 | Survey | [Stack Overflow 2025](https://survey.stackoverflow.co/2025/developers/) |
| DM-23 | Developer Nation reports documentation as the leading onboarding resource, with 39.3% calling it essential when starting with a new technology. The page doesn't give this item's denominator. | 2025 | Survey | [Developer Nation DN29](https://www.developernation.net/developer-reports/dn29/) |
| DP-25 | Linear advises writing changelog entries about things interesting to a reader rather than everything the team did. | 2020-05-18 | Practitioner | [Linear](https://linear.app/now/startups-write-changelogs) |

## Hacker News

| ID | Finding | Date | Grade | Source |
| --- | --- | --- | --- | --- |
| HC-13 | HN asks submitters to use the original source and, generally, the original title unless it is misleading or linkbait. | Live | Official | [HN guidelines](https://news.ycombinator.com/newsguidelines.html) |
| HC-16 | Under "In Comments", HN says: "Don't post generated text or AI-edited text. HN is for conversation between humans." The rule has no length exception. The quoted passage sits in the comment section and does not itself cover link submissions; Cratis applies it to everything it posts on HN as its own stricter policy. | Live | Official | [HN guidelines](https://news.ycombinator.com/newsguidelines.html) |

## Batch variety and measurement

| ID | Finding | Date | Grade | Source |
| --- | --- | --- | --- | --- |
| HV-06 | In the genres and models studied, LLM-written text struggled to match the stylistic variation of human writing. An aggregate finding; it can't classify a single post. | 2025-02-25 | Peer-reviewed | [Corpus study](https://pmc.ncbi.nlm.nih.gov/articles/PMC11874169/) |
| LI-13 | Within the same account, LinkedIn posts where the author replied had about 30% more engagement. Buffer says this is not causal. | 2026-03-05 | Vendor | [Buffer](https://buffer.com/resources/state-of-social-media-engagement-2026/) |
| MD-01 | Tagged campaign URLs identify the source, medium and campaign of an arrival. They don't capture earlier influence. | Live | Official | [Google Analytics](https://support.google.com/analytics/answer/10917952) |
| MD-12 | GitHub describes a star as a way to find a repository again later. A star alone doesn't show installation or use. | Live | Official | [GitHub Docs](https://docs.github.com/en/get-started/exploring-projects-on-github/saving-repositories-with-stars) |

The batch mix targets in the skill (two short and two long posts in any ten, and so on) are
Cratis editorial targets. No source in this file tests them.

## Not verified here

These came up during research but were not verified for this file. Don't cite them from
memory; check the live source first and add an entry if it holds up.

- Search engine statements about word count and ranking.
- Current YouTube Shorts maximum length and YouTube retention definitions.
- Published-article studies relating word count to engaged time, links or shares.
- Older usability research on web scanning and reading rates.
- Email benchmark data and any newsletter length study.
- Socialinsider's quarterly LinkedIn format averages.

## Folklore

| Claim | What the evidence says |
| --- | --- |
| "Every post must be short." | Not supported as a rule. In AuthoredUp's personal-profile sample the shortest band had the lowest median engagement (LM-02). That is an association, and a short post is still right for one idea. |
| "1,300–2,500 characters wins the algorithm." | Not supported. The longer-band result is personal profiles only and not causal (LM-01), and LinkedIn's ranking description names no rewarded length (LM-08). |
| "Company pages should copy what works on personal profiles." | The length study covers personal profiles only (LM-01). Business-page benchmarks are a different population (LM-06). |
| "A high carousel engagement rate means people read it." | Page-advance clicks can count as engagement (LM-11). |
| "LinkedIn accepts 300-page documents, so length doesn't matter." | An upload maximum reported by a third party (LM-12). It isn't an editorial target. |
| "Seven to nine slides is the proven optimum." | One agency's channel, 114 posts, uncontrolled topic and design (LM-09, LM-10). |
| "52% of viewers finish short videos." | Wistia's 52% is the average share of a video's length watched, on hosted video (LM-18). |
| "Videos over a minute fail." | Wistia suggests different lengths for different goals, up to 30 minutes for motivated viewers (LM-19, LM-20). |
| "Longer videos cause more conversions." | Wistia's 9% click-through figure for 5–30 minute videos is observational (LM-20). |
| "Short AI-edited comments are fine on HN." | HN's comment rule has no length exception (HC-16). |

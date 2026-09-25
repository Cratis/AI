# Playbook evidence

The sources behind the developer-marketing skill, checked on 2026-09-25. Each entry says what
the source found or describes, and how far it can be stretched. Company practices are
summarized in our own words. Read the originals before quoting them.

Evidence types used below:

- **Official:** a platform or project describing its own rules or system. Good evidence of
  the rule. It doesn't show that a tactic works.
- **Peer-reviewed:** a published study. Check whether its population resembles yours.
- **Survey:** self-reported answers from a recruited sample. Shows what respondents say, not
  what they did.
- **Vendor observational:** a tool vendor's analysis of its own customers' data. Shows
  association in that sample, not cause, and not the whole platform.
- **Company practice:** how one company says it works. A pattern to consider, not a result
  to borrow.
- **Case example:** a single published piece that shows a technique in use.

## How developers find and evaluate tools

Stack Overflow's surveys are large but recruited mostly through Stack Overflow's own
channels. The 2025 methodology notes that highly engaged users were more likely to see the
invitation. Different years asked different questions, so don't read the figures as a trend.

- In 2025, technical documentation was the most-used resource for learning in the past
  year, at 67.8% of respondents. Survey.
  https://survey.stackoverflow.co/2025/developers/
- In 2024, asked how they discover and research solutions when buying a tool, 75.2% chose
  starting a free trial and 72.5% chose asking developers they know. The page's narrative
  says "evaluate", but the question is about discovery and research. Survey.
  https://survey.stackoverflow.co/2024/work/
- In 2024, asked where they first go with a technical question at work, about 55% said
  traditional search and 15% AI-powered search. Survey.
  https://survey.stackoverflow.co/2024/professional-developers/
- In 2024, 75.2% selected APIs among the features they care about when endorsing a purchase.
  The page's own wording implies APIs make endorsement more likely. The question doesn't
  show that. Survey. https://survey.stackoverflow.co/2024/work/
- In 2025, for work projects, APIs ranked first and quality second among attraction or
  endorsement factors. AI integration ranked ninth, second to last. The top reasons to
  reject a technology were security or privacy concerns, prohibitive pricing and better
  alternatives, in that order. Survey. https://survey.stackoverflow.co/2025/work/
- Reported influence over purchases varied by role in 2024: the page highlights senior
  executives at 99%, engineering managers at 87% and product managers at 77% reporting some
  influence. In 2025, 48% said they had endorsed or influenced a technology in the past year,
  and some of those endorsements led to no purchase or use. Survey.
  https://survey.stackoverflow.co/2024/work/ and https://survey.stackoverflow.co/2025/work/
- In 2025, more respondents distrusted the accuracy of AI-tool output (46%) than trusted it
  (33%). The biggest frustrations were AI answers that are almost right (66%) and debugging
  AI-generated code taking longer (45%). Survey. https://survey.stackoverflow.co/2025/ai/
- Developer Nation's Q1 2025 report names documentation the leading onboarding resource
  (39.3% called it essential), followed by tutorials and how-to videos (32.7%) and sample
  projects (28.9%). The most common first-use problem with vendor resources was a lack of
  examples suited to the reader's skill level (16.3%). The item denominators are not stated
  on the public page. Survey. https://www.developernation.net/developer-reports/dn29/

## Openings, hooks and clicks

- The Upworthy archive holds headline-and-image A/B tests run from January 2013 to April
  2015 on a U.S. news and entertainment site. Tests varied whole packages, so single
  properties aren't isolated. Peer-reviewed dataset.
  https://www.nature.com/articles/s41597-021-00934-7
- A 2025 registered report across 8,977 of those experiments found that more concreteness
  helped headlines that were too vague and hurt ones that were already too concrete. The
  authors caution that the audience was one site's mostly American readers. Peer-reviewed.
  https://www.nature.com/articles/s41598-024-81575-9
- A 2023 registered report found that linguistic features predicted the higher-CTR headline
  only 54% of the time across pairs. Peer-reviewed.
  https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0281682
- Another 2023 registered report estimated that each extra negative word raised CTR by 2.3%
  relative (not percentage points) for an average-length headline, and names the site's
  clickbait style as a limit on generalizing. Nothing here measures trust or reading.
  Peer-reviewed. https://www.nature.com/articles/s41562-023-01538-4
- A study of more than 4,400 Facebook news posts associated clickbait features with post
  interactions in both directions and had no click-through data at all. Observational.
  https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0266743
- Google's title-link guidance asks for descriptive, concise titles and warns against vague
  or needlessly long ones. It governs search titles, not social hooks. Official.
  https://developers.google.com/search/docs/appearance/title-link

## Platform rules

- Hacker News asks for the original source and generally the original title unless it is
  misleading or linkbait. It discourages attention-grabbing capitalization and
  editorializing, allows posting your own work some of the time but not primarily for
  promotion, prohibits soliciting votes or comments, and in its comment guidelines prohibits
  generated or AI-edited text. The generated-text rule sits under comments. Cratis applies
  it to titles and submission text too, as its own stricter policy. Official.
  https://news.ycombinator.com/newsguidelines.html
- LinkedIn says members may use AI to refine language but posts and comments should
  represent their own voice and perspective. It says apparently AI-generated content that
  lacks a clear perspective is less likely to spread beyond the immediate network. That is
  not a ban on AI assistance. Official.
  https://news.linkedin.com/2026/keeping-conversations-real-on-linkedin
- LinkedIn's engineering team describes LLM-based retrieval and sequential ranking that
  learn from profile context and reading, liking, commenting, returning and scrolling past.
  It publishes no weights and no fixed early-engagement cutoff. Official.
  https://www.linkedin.com/blog/engineering/feed/engineering-the-next-generation-of-linkedins-feed

## How developer-tools companies work

Summaries of published practice. None of these reports a controlled result, and several
pages are years old.

- **PostHog** treats content as its main marketing effort and says it sets no arbitrary
  volume goals and doesn't rely on AI to write. Writers decide who a post is for and how it
  will reach them before drafting, with social described as fast and spiky and search as
  slow and compounding. Its voice guide asks for concrete examples, directness and honesty
  about limitations. Engineers write about their own work and may use AI for research and
  line edits, not the whole piece. It focuses on three primary social platforms and doesn't
  tailor posts for secondary ones. It reports that on LinkedIn, individuals' content does
  better and reads as more earnest than brand content, with no numbers given. It warns that
  one video doing well isn't enough to change strategy. It separates a product release,
  owned by the product team, from a marketing launch, and prefers small rolling launches.
  Company practice (living handbook).
  https://posthog.com/handbook/content,
  https://posthog.com/handbook/content/blogs,
  https://posthog.com/handbook/brand/tone,
  https://posthog.com/handbook/engineering/writing-blogs,
  https://posthog.com/handbook/content/social-media,
  https://posthog.com/handbook/marketing/product-announcements
- **Supabase** planned its first Launch Week in 2021 after three more months of building,
  as a week of separate announcements. Later that year it wrote that it rarely held features
  back, shipped early, announced to existing users as things landed, and saved full
  write-ups and broad marketing for Launch Week. It said the engineer who built a feature
  often wrote its technical content and helped choose channels. Company practice, 2021,
  possibly stale. https://supabase.com/blog/launch-week and
  https://supabase.com/blog/supabase-how-we-launch
- **Vercel** published an engineering article that explains a latency problem, the cost of
  the obvious fix, the production experiments, and a 91% reduction in P99 metadata lookup
  latency. The number applies to that lookup, not the whole CDN. Case example, 2026.
  https://vercel.com/blog/how-we-cut-cdn-metadata-lookup-latency-by-91-percent
- **Tailscale** published a 2020 post in one engineer's playful first-person voice that
  still explains the real logging pipeline and what happens when the log server can't
  receive data. Case example, historical.
  https://tailscale.com/blog/the-log-blog
- **Stripe**'s developer blog pages link to its docs, YouTube channel, Discord and local
  meetups. These are site-wide links, not evidence that a given article was paired with a
  video or event. Case example. https://stripe.dev/blog/how-api-changes-flow-into-stripes-developer-products
- **Linear** advised in 2020 that changelogs cover what a human would find interesting, with
  internal work mentioned only when it changes performance or experience. Company practice,
  historical. https://linear.app/now/startups-write-changelogs
- **Fly.io** introduced an open-sourced service-discovery component through its own account
  of a 2024 outage and the concurrency bug behind it. Case example, 2025.
  https://fly.io/blog/corrosion/

Also reviewed, and left out because the specific claims were not independently checked:
Cloudflare, Resend, Temporal, Prisma, Turso, Oxide and Particular. Revisit them with a fresh
check before citing.

## Distribution, frequency and replies

- Buffer distinguishes crossposting (the same content on several platforms) from
  repurposing (a core idea reworked into a different format). Vendor guidance, 2026-01-20.
  https://buffer.com/resources/repurposing-content-guide/
- Buffer's analysis of over two million LinkedIn posts from more than 94,000 accounts
  associates two to five posts a week with 1,182 more impressions per post and 0.23
  percentage points more engagement than one a week. It suggests starting in a sustainable
  range and trying a higher pace for a month while tracking. Vendor observational, not
  causal. https://buffer.com/resources/how-often-to-post-on-linkedin/
- Buffer reports roughly 30% higher engagement within an account on LinkedIn posts where the
  creator replied, says causation is uncertain, and says its medians describe its own
  dataset. Vendor observational.
  https://buffer.com/resources/state-of-social-media-engagement-2026/
- Buffer's same report gives a median 21.77% engagement for LinkedIn document carousels in
  its sample. One agency's carousel analysis counts slide-advance clicks as engagement.
  Vendor observational and small study.
  https://www.seoworks.co.uk/downloads/data-led-analysis-of-linkedin-video-vs-carousels/

## Example: a specialist audience

The .NET and event-sourcing audience shows how one "developer community" is really several
places with different norms. Broad discovery happens through creator videos, newsletters,
blogs and conferences. Deeper modeling and event-sourcing conversations live in narrower
venues. Audience counters on those channels are not active readers, and none of this
measures which format works for a given product.

- Oskar Dudycz's 2026 article on fixing bugs in event-sourced systems opens with bad data
  from integrations, users and shipped changes, then a support incident. Case example.
  https://event-driven.io/en/fixing-bugs-in-event-sourcing-is-hard/
- Jeremy D. Miller's writing distinguishes Wolverine's logical message deduplication from
  transactional-inbox idempotency, the kind of precise distinction practitioners argue
  about. Case example. https://jeremydmiller.com/
- Marten describes itself as a PostgreSQL-backed .NET document database and event store
  and links tutorials and a chat. Official. https://martendb.io/
- Kurrent runs a discussion forum with product and Domain-Driven Design categories.
  Official. https://discuss.kurrent.io/
- Virtual DDD builds sessions around problems members bring, solved or not, and continues
  discussion on Discord. That describes the community. It doesn't grant permission to
  promote there. Official. https://virtualddd.com/
- NDC links most earlier talks from its YouTube archive. Official.
  https://ndcconferences.com/
- Jimmy Bogard reported over 700 registrations for a webinar. Registrations, not
  attendance. Case example.
  https://www.jimmybogard.com/vertical-slice-architecture-webinar-recording-and-whats-next/

## Folklore sources

| Claim | Why it fails | Source |
| --- | --- | --- |
| Links in the LinkedIn body kill reach | Format medians don't isolate link placement | https://buffer.com/resources/state-of-social-media-engagement-2026/ |
| The first hour decides a post | LinkedIn discloses no cutoff | https://www.linkedin.com/blog/engineering/feed/engineering-the-next-generation-of-linkedins-feed |
| Exact hashtag counts, or saves outrank likes | No weights published | Same LinkedIn Engineering post |
| Carousels drive developer adoption | Engagement can include slide clicks; no adoption data | Buffer report above; https://www.seoworks.co.uk/downloads/data-led-analysis-of-linkedin-video-vs-carousels/ |
| Founder posts have a fixed multiplier | One company's unquantified observation | https://posthog.com/handbook/content/social-media |
| Everyone should post two to five times a week | Observational association | https://buffer.com/resources/how-often-to-post-on-linkedin/ |
| Negative or mystery hooks win with engineers | Historical news-site CTR, not trust or adoption | https://www.nature.com/articles/s41598-024-81575-9 and https://www.nature.com/articles/s41562-023-01538-4 |
| Documentation only matters after the sale | Developers report using docs to learn and onboard | https://survey.stackoverflow.co/2025/developers/ and https://www.developernation.net/developer-reports/dn29/ |
| Stars, impressions or last clicks equal adoption | Different events | https://docs.github.com/en/get-started/exploring-projects-on-github/saving-repositories-with-stars and https://support.google.com/analytics/answer/9756891 |
| HN welcomes polished promotional replies | Its rules prohibit generated comments and primarily promotional use | https://news.ycombinator.com/newsguidelines.html |

Unchecked and not used: current subreddit rules, live platform character limits (see the
content-length skill), and any vendor benchmark not listed above. Check them at the time of
use.

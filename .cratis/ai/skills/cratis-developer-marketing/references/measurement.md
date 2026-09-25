# Measurement

How to tell whether developer content helped, without claiming more than the data shows.
Sources were checked on 2026-09-25. Analytics products change their definitions, so
re-read the linked documentation before relying on a specific report.

The unit worth measuring is a progression. A relevant engineer meets one specific idea,
reaches the right page, reads or runs something, and comes back with a real question or a
working setup. No public source gives a conversion rate for that sequence, and none will
give you one for your product. What you can do is observe each stage honestly and keep them
apart.

## The stages

| Stage | What to record | What it tells you | What it doesn't |
| --- | --- | --- | --- |
| Production and effort | Pieces shipped by account and type; author, reviewer and asset hours; date the product facts were last checked | What the program costs and whether its claims are fresh | Anything about the audience |
| Relevant attention | Native impressions and reach per post; substantive technical comments and questions, counted and categorized by hand; author replies | Platform-reported exposure and observed discussion; audience relevance requires separate evidence | Whether the people reached were the intended audience, went anywhere, or learned anything |
| Qualified arrival | Tagged visits to the exact canonical page; engaged sessions or a next-page action; search queries and clicks for that page | That a visit arrived through a tagged link or a search result | Every influence before that visit |
| Evaluation intent | Visits to prerequisites, examples, migration or limits pages; copy, run or download events if already instrumented with consent; distinct useful questions in the project's discussion venue | Signals consistent with product inspection, not proof of intent | Whether the visitor intended to evaluate the product, installed it, or succeeded |
| Adoption and learning | First successful task and return use, only where the product already measures them lawfully; recurring questions; optional self-reported source | The strongest signal available, and often missing | Why it happened, on its own |

Keep founder and company accounts in separate rows. Keep paid and organic separate. Don't
add the columns up into "people reached" or "attributed users". They count different events,
often of the same person.

## What common metrics mean

| Metric | What it is | Don't read it as |
| --- | --- | --- |
| Impressions | Times the platform showed the post | People who read it |
| Engagement rate | Interactions divided by the report's stated denominator. Record included interactions and whether the denominator is impressions, reach, followers, or another measure; compare only compatible definitions. At least one published carousel analysis counts slide-advance clicks as engagement | Comprehension, trust, or interest in the product |
| Comments | Replies of any quality | Qualified interest, until you read and categorize them |
| Followers, subscribers | Accounts that opted in at some point | Active readers or users |
| GitHub stars | GitHub describes starring as a way to find a repository again later | Installation or use |
| Registrations for an event | People who signed up | Attendance, or demand beyond that event |
| UTM-tagged visit | An arrival through a link carrying source, medium and campaign tags | Everything that influenced the visitor before that click |
| GA4 channel groups | Event-scoped groups use the property's attribution model; session-scoped groups use last click. The two can credit the same visit differently | Interchangeable numbers. Say which scope a figure uses |
| Direct traffic | Google defines it as arrival through a saved link or a typed URL | Proof that no earlier content played a part |
| Search Console data | Google Search impressions and clicks by query, page and country | Task success on the page |
| AI assistant referrals | Visits whose referrer identifies an AI tool. One 3,000-site vendor sample put them at 0.17% of the average site's visitors, and the vendor warns some arrive as Direct | A complete count of AI-driven discovery |
| Last click | The final tagged or referred step before a visit | The reason anyone chose to try the product |

## Self-reported attribution

Ask "How did you hear about us?" as an optional free-text question at a point where people
already stop, such as signup, a contact form or a support request. It catches influence that
never produced a click: a colleague's recommendation, a talk, an answer from an AI tool.

Treat it as triangulation. Answers depend on memory and on who bothers to answer, and many
people won't. Report the number who answered next to every
figure, and compare its story with the tagged and native data. Where all three point the
same way, you have something. Where they disagree, say so.

## A UTM convention

Tag links you control, and keep the scheme boring enough that nobody improvises:

```text
utm_source=linkedin       # the site the link lives on
utm_medium=social         # social, email, community, video
utm_campaign=<pillar>     # the recurring question, not the date
utm_content=<piece-id>    # which derivative carried the link
```

Don't tag links inside community answers when the venue's norms frown on tracking links. An
untagged honest answer is worth more than the attribution.

## Scorecard template

Fill one row per piece per observation window. Leave a cell marked "not measured" instead of
guessing. Keep raw exports, identifiers and personal data out of content repositories.

| Field | Example entry |
| --- | --- |
| Piece | URL or post ID, account, author |
| Type and topic | LinkedIn document post, pillar name |
| Canonical source | Page URL and product version |
| Published | Date, organic or paid |
| Window | Days observed, and date reviewed |
| Effort | Author, review and asset hours |
| Attention | Impressions; substantive comments and questions (count, with categories) |
| Replies | Author replies, and questions left open |
| Arrival | Tagged sessions to the canonical page; engaged or next-page sessions |
| Evaluation | Visits to examples, limits or migration pages; useful questions in the discussion venue |
| Adoption | First-task or return-use events if measured; otherwise "not measured" |
| Self-reported | Mentions of this piece or channel, with how many people answered |
| Notes | Anything that confounds the week: a release, an outage, a holiday |

Review a piece after several days, then look at the canonical page's arrivals and evaluation
signals again a few weeks later. One developer-tools company describes social discovery as
fast and spiky and search as slow and compounding, so judge each on its own clock.

## Small-sample experiments

A small team won't get statistical certainty from its own posts. It can still run a fair
comparison and avoid fooling itself.

1. Write the question before publishing. For example: "On the company page, do posts that
   show one mechanism in a two-card image bring more qualified arrivals and implementation
   questions than matched text explanations?"
2. Hold the account constant and match topics and claim readiness as closely as you can.
   Alternate the formats so one doesn't get all the good weeks.
3. Name one primary outcome and the smallest difference that would change what you do.
   Impressions alone are not a primary outcome.
4. Fix the observation window for every post in advance.
5. Write the stop rule: how many posts per arm, or how many weeks, before you decide, and
   what result counts as inconclusive. Also note any harm that stops it early, such as a
   drop in substantive replies or a format eating into reply time.
6. Record production time for each arm. A format that performs slightly better at triple the
   effort may not be the better choice.
7. Report raw counts per arm and the spread between posts, not only an average. Say plainly
   when the result is inconclusive, which will be often.

One post doing well is not a finding. One developer-tools company's handbook makes the same
point about a single successful video. A large scheduling vendor suggests starting at a
sustainable frequency and trying a higher one for a month while tracking the change. Treat
that as a pilot you run and measure, not a result you can borrow.

Call the result a local observational pilot unless you had a real holdout, and never promise
a causal growth effect from it.

## Sources

- Google Analytics, campaign URL parameters: https://support.google.com/analytics/answer/10917952
- Google Analytics, default channel groups and attribution scopes: https://support.google.com/analytics/answer/9756891
- Google Search Console overview: https://developers.google.com/search/docs/monitor-debug/search-console-start
- GitHub Docs, saving repositories with stars: https://docs.github.com/en/get-started/exploring-projects-on-github/saving-repositories-with-stars
- GitHub Docs, about Discussions: https://docs.github.com/en/discussions/collaborating-with-your-community-using-discussions/about-discussions
- LinkedIn Help, Page analytics: https://www.linkedin.com/help/linkedin/answer/a547077
- Ahrefs, AI traffic study (2025-02-06), vendor sample of 3,000 sites: https://ahrefs.com/blog/ai-traffic-study/
- Buffer, how often to post on LinkedIn (2025-08-28), observational: https://buffer.com/resources/how-often-to-post-on-linkedin/
- Buffer, state of social media engagement (2026-03-05), observational: https://buffer.com/resources/state-of-social-media-engagement-2026/
- PostHog handbook, social media: https://posthog.com/handbook/content/social-media
- PostHog handbook, blogs (social versus search discovery): https://posthog.com/handbook/content/blogs
- The SEO Works, LinkedIn video and carousel analysis (2025, one agency's sample; slide clicks counted as engagement): https://www.seoworks.co.uk/downloads/data-led-analysis-of-linkedin-video-vs-carousels/

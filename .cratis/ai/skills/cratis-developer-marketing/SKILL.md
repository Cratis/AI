---
name: cratis-developer-marketing
description: Plan or review how developer-facing content earns real engagement and adoption - positioning with developers, choosing the canonical artifact and its channel-native entry points, community participation, founder and company voice, a cadence a small team can keep, and measurement that doesn't fake attribution. Use when planning a content program, a launch, a distribution plan, a channel choice, a measurement plan or a repurposing plan. Do not use for drafting a specific feed post (use cratis-social-feed-post), voice review (cratis-writing-voice-and-cadence), length decisions (cratis-content-length), release notes (cratis-release-notes) or code examples (cratis-technical-examples).
license: MIT
---

# Developer marketing

This skill is for the plan around the content: who it is for, where the full version lives,
which channels get a native version of it, who answers the replies, and how anyone will know
whether it helped. It does not write the post, the article or the sample. Other skills own
those, and this one names them when the plan reaches that point.

The evidence behind this skill is summarized in
[playbook evidence](references/playbook-evidence.md), dated and graded. Most of it is
survey data, vendor observation and company practice. None of it tells you what will work
for a specific product, so the plan should say what it expects and how it will check.

Nothing in a plan is published, scheduled or replied to by an agent. A person does all
three.

## How developers find and judge a tool

Survey answers point the same way, though they come from different questions in different
years and don't describe one funnel. Respondents learn from documentation more than from
any other resource. When asked how they discover and research a tool to buy, most
picked starting a free trial and asking developers they know. When asked what attracts them
to a technology for work, APIs ranked first and quality second. When asked what makes them
reject one, security or privacy concerns ranked first, then price, then a better
alternative. AI integration ranked near the bottom of the attraction list, and more
respondents distrusted the accuracy of AI tools than trusted it.

These are stated preferences from self-selected samples, not measured purchases. They still
say something useful about what a first encounter should offer:

- the interface a developer would call, shown with real identifiers at a stated version;
- what it does when things go wrong, not only on the happy path;
- the limits, including the cases it doesn't handle;
- a path the reader can run in minutes, with a visible result.

A post that can only say "it's powerful" gives the reader nothing to try or forward to a
colleague.

The person who writes the code is often not the only one deciding. Reported influence over
purchases varies a lot by role, and executives and engineering managers report the most. Plan two views of the same capability. The implementer gets
runnable evidence. The person accountable for the decision gets an honest account of
operational risk, migration, security scope, cost and support. Don't build separate
funnels for them. On a small team the same person may need both views in one week.

## Trust comes from specifics

Developers have seen every adjective. What moves them is a command, a measured number with
its method, a trade-off stated plainly, and a comparison that a user of the other tool would
accept as fair.

- Name the limitation in the sentence it limits.
- Compare against the alternative a reader would actually consider, including "keep doing
  what you do now". If you can't state the alternative's strengths, you aren't ready to
  compare.
- Give a number only with its method and scope. "P99 lookup latency for this path" is a
  claim. "Faster" is decoration.
- Leave out manufactured urgency ("before it's too late"), fake consensus ("everyone is
  moving to...") and unattributed authority ("studies show").
- Claims about AI features need extra proof, given how many developers report distrusting
  AI output.

## Openings that promise something true

Several studies analyzed thousands of historical Upworthy headline experiments. They found
that wording changes clicks, that more concreteness helped vague headlines
and hurt ones that were already very concrete, and that linguistic features predicted the
winning variant only a little better than chance. Negative words were associated with a
small relative rise in click-through. None of them measured trust, reading or adoption, and
the audience was not engineers evaluating a tool. A higher click-through rate tells you the
opening was clicked. It says nothing about whether the reader felt misled afterward.

So the opening makes a specific, truthful proposition about the subject and then delivers
it. It names the problem or the result. It does not withhold the subject to force a click.

Story shapes to consider when the material supports them:

- A real incident or bug: the symptom, what you first assumed, how you found the cause,
  the fix, and what still isn't solved.
- Before and after: the code or model a reader writes today, then the changed version,
  with what it costs.
- A teardown with its method: what you measured, how, on what, and where the method is
  weak.
- A decision with its trade-offs: the options you considered, why you rejected them, and
  what you gave up.

Incident stories and "I was wrong" stories must be real, and the named author has to own
them. Never invent a failure, a customer, a late night or a change of mind to give a piece a
narrative arc. If a scenario is illustrative, say so in the text.

## One canonical source, many entry points

Work from the top down:

1. A pillar: a recurring question the audience actually has.
2. One canonical, owned source for each piece of it: a versioned article, tutorial or
   documentation page that holds the full explanation, the runnable path and the limits.
3. Channel-native derivatives: each one a complete, smaller insight written for its
   channel, not a teaser and not the same text pasted everywhere.
4. Community answers: replies to questions people are already asking, linking the
   canonical source only when it answers them.

Repurposing means taking the core idea into a new format. Crossposting means copying the
same text. Plan for the first. A derivative should still be useful to someone who never
clicks, and it should link the canonical source when the reader needs it, such as the
runnable sample the post is about.

Channel norms, in brief. Length and character limits are in **cratis-content-length**, and
feed drafting is in **cratis-social-feed-post**.

| Channel | What it is good for | Norms to respect |
| --- | --- | --- |
| LinkedIn | One insight for practitioners and decision-makers | Posts lead with media by default; text-only is a deliberate, recorded choice |
| X, Bluesky | A single finding inside an ongoing conversation | Short, conversational, one idea per post |
| Mastodon | Technical peers who expect context in the post | Each server has its own rules; alt text on every image |
| Reddit | Answering a question a community asked | Read that subreddit's current rules first; say you work on the project |
| Hacker News | Original technical work people can try or learn from | Human-written only (see below); original titles; never ask for votes |
| dev.to, Hashnode | The complete tested piece for readers there | The full article, not a teaser; point to the canonical source |
| YouTube | Behavior that needs to be seen: debugging, a sequence, a UI | Title and thumbnail match what the video shows |
| Newsletter | Repeat contact with people who asked for it | One or a few things subscribers want; judge by replies and clicks, not opens |
| Search and answer engines | People who arrive with a task | Descriptive titles, accurate current pages; AI referrals are undercounted |

On LinkedIn, leading with media is the Cratis editorial default and an open hypothesis
the team is measuring. It is not a proven cause of reach. Record the reason when a post
goes out as text only, so the comparison stays honest.

Every published Cratis media asset carries the Cratis mark: images, cards, document pages,
every GIF frame, video and screenshots. Captures are framed, never stamped. This is a brand
and attribution rule, not a growth claim. Placement details are in
**cratis-social-feed-post**.

Hacker News has its own rule. Its guidelines prohibit generated or AI-edited comments. Cratis
applies that to everything it posts there, including titles, submission text and comments.
HN's rule is written for comments, so the wider scope is Cratis's own, stricter policy. An assistant
may collect facts and links for the person writing, and must not draft or edit what they
post.

## Founder and company accounts

The two accounts do different jobs. The founder speaks from firsthand judgment: what they
decided, what surprised them, what they would do differently. The company account speaks
for reviewed product facts and maintained explanations, as the team that built them.

One developer-tools company reports that, for it, content from individuals on LinkedIn
performs better and reads as more earnest than brand content. That is one company's
observation with no effect size. Don't assume a founder multiplier. Measure each account
against its own history.

Employees may share or comment when they have something to add from their own work. A
colleague's reshare with a sentence about how they used the feature is real. Engagement
pods, coordinated likes, scheduled "thanks for sharing" comments and requests for votes are
not, and they are off limits.

A founder post is written or approved by the founder, in their words. Never put an opinion
or an experience in someone's mouth. See **cratis-writing-voice-and-cadence** for the rules
on attributed writing.

## Community participation

Every community has its own members, habits and rules, and it was there before you arrived.
Treat a thread as a conversation you join, with the same manners you'd expect from a
visitor in your own project.

- Answer the question that was asked, in full, in the thread. Link only if the link adds
  something the answer can't hold.
- Say you work on the project whenever you mention it.
- Read and follow the venue's current rules. Being able to join a server does not grant
  permission to promote in it.
- Don't drop the same link into several communities on launch day.
- Specialist groups often run on member-proposed problems. Bring a problem to work through,
  not a pitch.
- A project-adjacent venue such as GitHub Discussions needs someone who answers and marks
  questions resolved. Don't open a new chat community until someone can moderate it.

## Launches

Keep the release separate from the launch. The product team ships when a change is ready
and documented. The launch is a later, deliberate effort to explain it to people who
haven't heard of it. Two developer-tools companies describe shipping features as soon as
they are ready and then writing the full explanation for a launch moment. The person who
built the feature is often the right one to write the technical piece and pick its channels.

A launch plan names the canonical piece, the few derivatives, who is present to answer
questions on launch day and the week after, and what would count as a good result.

## Cadence a small team can keep

Count the whole cost of a piece: verifying product claims, making and checking assets, alt
text, answering replies, and updating the canonical page when the product changes. Then set
a pace that covers all of it.

There is no required frequency. One large vendor study associates two to five LinkedIn posts
a week with more impressions per post than one, and it is observational. One
developer-tools company says outright that it doesn't set arbitrary volume goals. Start
with what the team can sustain, keep it steady for long enough to compare against itself,
and change one thing at a time. A burst followed by weeks of silence is hard to measure and
leaves replies unanswered.

Replies are part of the work. The same vendor data associates author replies with higher
engagement within an account and does not claim cause. Plan the time anyway. A technical
question left unanswered under a post is also a reader who got stuck.

## Measurement

Measure a progression, keep each stage in its own column, and never add them together as if
they counted the same people. The stages, what each metric does and does not mean, a
scorecard template and a small-sample experiment design are in
[measurement](references/measurement.md).

A star is a bookmark. An impression is a render. A last click is where a visit came from,
not what convinced anyone. Report the actual event and its denominator.

## Folklore

| Claim | Status |
| --- | --- |
| A link in the LinkedIn body kills reach, so always put it in the first comment | Unproved; format studies don't isolate link placement |
| The first hour decides a post's fate | No disclosed cutoff |
| Use exactly N hashtags, or saves outrank likes | No published weights or counts |
| Carousels reach more developers and drive adoption | Observed engagement can include slide clicks; adoption not measured |
| Founder posts get a fixed reach multiplier | One company's observation, no effect size |
| Everyone should post two to five times a week | Observational association, not a prescription |
| Negative or mystery hooks win with engineers | Historical news-site CTR only; not trust or adoption |
| Documentation only matters after the sale | Developers report using docs to learn and onboard |
| Stars, impressions, followers or last clicks equal adoption | Different events; report the real one |
| Hacker News is a channel for polished promotional replies | Its rules prohibit generated comments and primarily promotional use |

Sources are in [playbook evidence](references/playbook-evidence.md).

## What a plan contains

- The reader, their task, and the question the pillar answers.
- The canonical source, its version, and who keeps it current.
- Each derivative: channel, account, author, format, and the one insight it carries.
- Community venues, with their current rules checked and the person who will answer.
- The capacity it assumes, in hours, including replies and maintenance.
- The claims that need product verification before anything is drafted.
- A measurement hypothesis with a primary outcome, an observation window and a stop rule.

## Stop conditions

Stop and ask when the author of a first-person piece hasn't confirmed the experience, when a
claim has no verified source, when a venue's rules are unknown, or when the plan depends on
tracking that the site doesn't already have with consent. A plan authorizes nobody to
publish, schedule, reply, tag or upload.

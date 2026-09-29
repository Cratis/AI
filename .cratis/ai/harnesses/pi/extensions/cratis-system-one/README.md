# cratis-system-one (experimental)

A Pi extension that measures whether a **System One model** helps with the Cratis skill corpus.
A System One model does not write text. It takes some text plus typed yes/no questions and returns
probabilities in a few hundred milliseconds. This extension asks one question per Cratis skill, "would
this skill help with the prompt?", and **records the answers next to what the model actually did**.

**Advisory and shadow-only.** In this version the extension changes nothing the model sees: it adds no
hint, edits no system prompt, and never delays a prompt. It exists to answer one question with data:
do models miss skills they should have loaded, and does a System One model see that? Nothing here is
a claim that it helps until that data says so. Scores are evidence, never authorization.

It is **off until you turn it on**, and only you can turn it on.

## Set it up

Run this in Pi:

```text
/system-one setup
```

It walks you through four things:

1. **Choose a backend** (see the table below).
2. **A key**, if the backend needs one. An environment key is used when present. Otherwise you type
   it once and it is stored only in your user file. Pi's input box does not mask typing, so prefer
   `SYSTEMONE_API_KEY` in your environment if you would rather store nothing.
3. **What leaves your machine, stated exactly, and a confirmation.** Nothing is saved before you
   confirm.
4. **A probe**: one tiny request, with its latency and result shown. It saves as enabled only if the
   probe works. If it fails you can save anyway (the extension fails open) or stop.

Without a UI (print mode) the command prints the same steps to do by hand.

Your choice is stored in `<pi agent dir>/cratis-system-one.json` (Pi's agent directory, `~/.pi/agent`
unless `PI_CODING_AGENT_DIR` says otherwise), written atomically with mode `0600`:

```json
{
  "enabled": true,
  "endpoint": "https://api.typesafe.ai/v1/systemone",
  "consentedAt": "2026-01-01T00:00:00.000Z",
  "skillRelevance": { "mode": "shadow" }
}
```

`endpoint` is a full URL: `https`, or `http` only for `127.0.0.1`, `::1` or `localhost`. `model`
(default `jev-1.13.0`) and `apiKey` are optional. A file this version does not understand disables the
extension and says so once; it never crashes Pi.

## Backends

| Backend | Endpoint | Key | Notes |
|---|---|---|---|
| **TypeSafe Jev** (recommended) | `https://api.typesafe.ai/v1/systemone` | `TYPESAFE_API_KEY` or `SYSTEMONE_API_KEY` | Most accurate. New accounts get **$5 of free credit** at [console.typesafe.ai](https://console.typesafe.ai). Your prompt text leaves the machine. |
| **Other System One provider** | Any `https` URL, for example OpenCode Zen `https://opencode.ai/zen/v1/systemone` | `SYSTEMONE_API_KEY` | Anything that speaks `POST /v1/systemone`. |
| **Local server such as [Laya](https://github.com/NandhaKishorM/laya)** | `http://127.0.0.1:8000` | none (`LAYA_API_KEY` if you set one) | Nothing leaves your machine. See the caveat below. |

**Laya caveat.** Laya (Apache-2.0) runs on CPU or Apple silicon, but in our test, without any training
on Cratis skills, it was **too slow and too imprecise for skill relevance**: 1.3 to 3.5 seconds per
prompt for 70 skills, with a poor ranking (many skills scored alike, and the obvious one was not at
the top). About 14 candidates took roughly 260 ms. It is still useful for trying the wiring without
a key. To run it, bind it to loopback, because it listens on `0.0.0.0` by default:

```bash
pip install "laya[serve]"
LAYA_HOST=127.0.0.1 laya-serve
```

Laya rejects more than 64 questions per request (HTTP 413), so this extension sends at most 32 per
request.

## What leaves your machine

Sent, to the endpoint you chose and nowhere else:

- the **names** of the Cratis skills Pi loaded, and the **first sentence** of each skill's description
  (capped at 200 characters each). These come from the corpus, not from your code.
- the **first 1,200 characters of each prompt** you submit, **after** slash-command and template
  expansion. If you paste a secret into a prompt, its first 1,200 characters are sent.
- the model name and, if you configured one, your API key as a bearer token.

Never sent: attachments and images, file contents, tool output, your repository's name or path, or
anything from earlier turns. Slash commands, very short prompts and turns with no corpus skills are
skipped and send nothing.

The extension does not keep a disk cache, and it stores **no prompt text** anywhere: session entries
hold only skill names, probabilities, timings and which `SKILL.md` files were read.

**Retention and privacy are the provider's.** For TypeSafe, read
[docs.typesafe.ai/legal](https://docs.typesafe.ai/legal) before enabling it. A local server keeps
whatever you configure it to keep.

## Who can change what

| Source | Can do |
|---|---|
| **You** (the user file, via `/system-one setup`) | Enable, choose endpoint, model, key and mode. |
| **The repository** (`.cratis/ai.json`) | Only **opt out or narrow**. It can never enable the extension or set an endpoint, key, model or timeout. |
| **The environment** | Disable (`CRATIS_SYSTEM_ONE=0`), narrow (`CRATIS_SYSTEM_ONE_SKILL_RELEVANCE=off`), or override `SYSTEMONE_ENDPOINT`, `SYSTEMONE_API_KEY` and `CRATIS_SYSTEM_ONE_MODEL`, **only once you have enabled it**. It never enables anything by itself: a globally exported `TYPESAFE_API_KEY` alone sends nothing. |

A committed `.cratis/ai.json` belongs to whoever controls the repository, so it must not be able to
send your prompts anywhere. A repository can protect its contributors like this:

```json
{
  "systemOne": { "enabled": false }
}
```

or keep System One on but turn this feature off:

```json
{
  "systemOne": { "skillRelevance": { "mode": "off" } }
}
```

Anything else in that section is ignored with one notice.

Key precedence is `SYSTEMONE_API_KEY`, then `TYPESAFE_API_KEY` (**only** for `https://api.typesafe.ai`),
then the `apiKey` in your user file. A key is sent only to the endpoint you configured. Redirects are
refused, so a server cannot forward your prompt or key elsewhere. The key is never shown in status
output, notices or session entries.

## Commands

| Command | Does |
|---|---|
| `/system-one setup` | The guided setup above. |
| `/system-one status` | State, the effective endpoint origin (never the key), request counts, failures by class, turns skipped and why, and the circuit breaker. |
| `/system-one last` | The latest turn's skills, highest probability first, with whether each `SKILL.md` was read. |
| `/system-one report` | Aggregates this session's shadow data (below). |
| `/system-one off` | Turns it off. Your file, and the record of your consent, stay. |

When it is not set up, the extension is completely silent: no notices, no requests. Only the
`/system-one` command exists.

## How it behaves

- **It never delays a prompt.** At `before_agent_start` the request starts in the background and the
  handler returns immediately. The answer is recorded when it arrives.
- **It fails open.** Each request has a 5 second timeout. Responses are validated strictly (asked ids,
  `noul` type, finite probabilities in `[0, 1]`); anything else, and any 401, 413, 422, 429, 529 or
  network error, counts as a failure and the turn is unaffected. A circuit breaker opens after three
  consecutive failures, or at once on 429 and 529, honoring `Retry-After`. You get one notice per
  error class per session.
- **Only corpus skills** that Pi already loaded and the model may invoke are asked about (managed
  `.cratis/ai/skills` or the packaged corpus). Skills you wrote yourself are never sent.
- **Limits.** At most 32 questions per request, sent concurrently. If more than 128 skills qualify,
  the call is skipped, not trimmed, and `/system-one status` says so.

## Reading the data

Each judged turn adds session entries of type `cratis-system-one`: the skills' probabilities (no
prompt), any failures, and, when the turn ends, **every `SKILL.md` the model read during the turn**,
suggested or not. `/system-one report` turns that into:

- turns judged,
- skills suggested at 0.5 or above, and how many of those the model then read,
- skills read that were not suggested,
- backend latency p50 and p95,
- failures by class.

The kill criterion for the whole idea is simple: if models already load the relevant skills about
90% of the time, or a System One model adds under about 10 points of recall, no hint is built.

**Limitations.**

- A read is counted only when the model uses the `read` tool on a `SKILL.md`. A skill file read with
  `cat` in bash is **not counted**.
- A skill read in an earlier turn is still in the conversation; entries list those as `readEarlier`.
- If Pi exits before the backend answers (for example `pi -p` finishing a fast turn), that turn's
  score is lost; the read record is still written.
- Session data lives in Pi's session file, so it is as private as the session.

## Installation

`cratis ai install` copies this extension into `.cratis/ai/harnesses/pi/extensions/cratis-system-one`
and Pi loads it from `.pi/extensions`. The `@cratis/pi` package loads its own copy and **stands
down** when a managed copy exists in the project, so it is never registered twice. It needs only Node
built-ins, the global `fetch`, and Pi's own packages.

For a general-purpose tool gate and an "ask Jev" tool, use
[`@y0usaf/pi-jev`](https://github.com/y0usaf/pi-jev) rather than this extension.

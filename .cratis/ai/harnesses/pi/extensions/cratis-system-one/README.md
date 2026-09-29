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
2. **A key**, if the backend needs one. An environment key is used when one applies to the endpoint
   (see *Keys* below). Otherwise you type it once and it is stored only in your user file, for that
   endpoint. For a local server the key question is optional: leave it blank for none. Pi's input box
   does not mask typing, so prefer `SYSTEMONE_API_KEY` in your environment if you would rather store
   nothing.
3. **What leaves your machine, stated exactly, and a confirmation.** Nothing is saved before you
   confirm. If `SYSTEMONE_ENDPOINT` is set in your environment and only changes the path of the
   endpoint you chose, setup says so and names the URL that will really receive data. If it points to
   **another origin** than the backend you chose, setup stops before asking for a key, disclosing,
   probing or saving anything, and so does a `SYSTEMONE_ENDPOINT` that is not a usable endpoint: unset
   it, or choose that endpoint ("Other System One provider"). The origin you chose, and the credential
   that is disclosed and probed, are recorded as what you agreed to. A key you typed for a local server
   is bound to that exact URL, so if a path-only override means it would not be sent, setup says so
   and does not store it.
4. **A probe** of that endpoint: one tiny request, with its latency and result shown. It saves as
   enabled only if the probe works. If it fails you can save anyway (the extension fails open) or stop.

Without a UI (print or JSON mode) the command prints the same steps, written to the terminal (stderr in
print and JSON modes), to do by hand. `/system-one` commands are written the same way when Pi has no UI;
with a UI they behave as usual.

Your choice is stored in `<pi agent dir>/cratis-system-one.json` (Pi's agent directory, `~/.pi/agent`
unless `PI_CODING_AGENT_DIR` says otherwise), written atomically with mode `0600`:

```json
{
  "enabled": true,
  "endpoint": "https://api.typesafe.ai/v1/systemone",
  "consentedAt": "2026-01-01T00:00:00.000Z",
  "consentedOrigin": "https://api.typesafe.ai",
  "keySource": "TYPESAFE_API_KEY",
  "skillRelevance": { "mode": "shadow" }
}
```

`consentedOrigin` is the origin (scheme, host and port) that setup disclosed and probed and you
confirmed. `keySource` is the
credential you agreed to: `none`, `typed` (the key stored in this file), `SYSTEMONE_API_KEY` or
`TYPESAFE_API_KEY`. Setup writes both, and both are required: an enabled file without either is refused
with one notice ("System One: your settings predate this version; run /system-one setup again."), and
nothing is sent.

`endpoint` is a full URL: `https`, or `http` only for `localhost`, `127.0.0.0/8` addresses and `::1`.
`0.0.0.0`, `::` and other unspecified addresses are refused. `model`
(default `jev-1.13.0`) and `apiKey` are optional. A file this version does not understand disables the
extension and says so once; it never crashes Pi.

## Backends

| Backend | Endpoint | Key | Notes |
|---|---|---|---|
| **TypeSafe Jev** (recommended) | `https://api.typesafe.ai/v1/systemone` | `TYPESAFE_API_KEY` or `SYSTEMONE_API_KEY` | Most accurate. New accounts get **$5 of free credit** at [console.typesafe.ai](https://console.typesafe.ai). Your prompt text leaves the machine. |
| **Other System One provider** | Any `https` URL, for example OpenCode Zen `https://opencode.ai/zen/v1/systemone` | `SYSTEMONE_API_KEY` | Anything that speaks `POST /v1/systemone`. |
| **Local server such as [Laya](https://github.com/NandhaKishorM/laya)** | `http://127.0.0.1:8000` | none, or a key you store in setup | Nothing leaves your machine. See the caveat below. |

**Laya caveat.** Laya (Apache-2.0) runs on CPU or Apple silicon, but in our test, without any training
on Cratis skills, it was **too slow and too imprecise for skill relevance**. Latency was 1.3 to 3.5
seconds for 70 skills, and the ranking was unreliable: in our 10-prompt test the expected skill
ranked anywhere from 1st to 70th. It is still useful for trying the wiring without a key. To run it,
bind it to loopback, because it listens on `0.0.0.0` by default:

```bash
pip install "laya[serve]"
LAYA_HOST=127.0.0.1 laya-serve
```

Laya rejects more than 64 questions per request (HTTP 413), so this extension sends at most 32 per
request.

## What leaves your machine

Sent, to the endpoint that will receive it (your choice, or `SYSTEMONE_ENDPOINT` if that overrides it;
setup and `/system-one status` name it) and nowhere else:

- the **names** of the Cratis skills Pi loaded, and the **first sentence** of each skill's description
  (capped at 200 characters each). These come from the corpus, not from your code.
- the **first 1,200 characters of each prompt you type in an interactive session**, in repositories
  set up with Cratis AI (those with `.cratis/ai.json` or `.cratis/ai.manifest.json`). If you paste a
  secret into a prompt, its first 1,200 characters are sent.
- the model name and, when one applies, your API key as a bearer token. Setup says which credential.

**Skipped, never sent:** slash commands and skill or template invocations (a prompt that starts with
`/` or is a `<skill …>` expansion), subagent tasks, text another extension injects into the
conversation (source `extension`), an RPC host's prompts (source `rpc`), anything in print, JSON or
other sessions without a UI, and your repository's name or path or anything from earlier turns.
`pi @notes.env "review this"` makes Pi build its first prompt as a `<file name="/abs/path">` block
holding the file, followed by your text. A prompt with a file block, or whose text starts with `<`,
is skipped whole. So is a prompt whose text is no longer what this extension saw typed, because an
input handler that runs after this one changed it. Very short prompts, turns with no corpus skills
and sessions outside a repository set up with Cratis AI send nothing either.

**Sent, whatever its origin:** anything that reaches Pi as a typed interactive prompt and passes those
checks. That includes text you paste, text you resubmit after `/tree` or `/fork` has put an earlier
message (or an extension's custom message or hook output) back in the editor, and text produced by
another extension's editor component or by an input handler that runs before this one, for example one
that expands an `@path` into the file's contents. This extension cannot tell those apart from typing.
See the limitations below. With Pi's default editor, an `@src/file.ts` mention or a pasted image's
temporary path is only a path, and is part of your text.

The extension does not keep a disk cache, and it stores **no prompt text** anywhere: session entries
hold only skill names, probabilities, timings and which `SKILL.md` files were read.

**Retention and privacy are the provider's.** For TypeSafe, read
[docs.typesafe.ai/legal](https://docs.typesafe.ai/legal) before enabling it. A local server keeps
whatever you configure it to keep.

## Who can change what

| Source | Can do |
|---|---|
| **You** (the user file, via `/system-one setup`) | Enable, choose endpoint, model, key and mode. |
| **The repository** (`.cratis/ai.json`) | Only **opt out or narrow**. It can never enable the extension or set an endpoint, key, model or timeout. It fails closed: a problem in that file, whether it cannot be read, is not valid JSON, or has a `systemOne` section that says anything else, **switches System One off** with one notice until fixed. |
| **The environment** | Disable (`CRATIS_SYSTEM_ONE` set to `0`, `false`, `off` or `no`), narrow (`CRATIS_SYSTEM_ONE_SKILL_RELEVANCE` set to `0`, `false`, `off` or `no`, in any case), or override `SYSTEMONE_ENDPOINT` (within the origin you set up; another origin turns System One off), `SYSTEMONE_API_KEY` and `CRATIS_SYSTEM_ONE_MODEL`, **only once you have enabled it**. It never enables anything by itself: a globally exported `TYPESAFE_API_KEY` alone sends nothing. |

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

Anything else in that section, or any other problem in `.cratis/ai.json`, switches System One off for
that repository and says why once, because a file that may have been trying to opt out is treated as
having opted out.

### Keys

- **Data and keys go only to the origin you set up.** If the effective origin (after any
  `SYSTEMONE_ENDPOINT`) is not the one recorded in setup, System One **turns itself off** with one
  notice ("System One: SYSTEMONE_ENDPOINT points to <origin>, which you did not set up; run
  `/system-one setup` to use it."), and nothing, key included, is sent. A different path on the same
  origin is fine.
- Precedence is `SYSTEMONE_API_KEY`, then `TYPESAFE_API_KEY` (**only** for `https://api.typesafe.ai`),
  then the `apiKey` in your user file. `SYSTEMONE_API_KEY` is attached to `https://api.typesafe.ai`, or to
  another origin only if you agreed to it there in setup (`keySource`). If you agreed to a typed key and
  `SYSTEMONE_API_KEY` is exported later for another origin, the stored key is used, the environment key
  is ignored, and `/system-one status` says so.
- **Environment keys are never attached to any loopback endpoint, `http` or `https`.** That is all of
  `127.0.0.0/8`, `::1`, IPv4-mapped forms such as `::ffff:127.0.0.1`, `localhost`, `*.localhost` and any
  of them with a trailing dot. A local server gets a key only if you stored one for that exact endpoint
  in setup.
- **Setup names the credential.** Before you confirm it says which one goes with the requests (your
  `SYSTEMONE_API_KEY` or `TYPESAFE_API_KEY` from the environment, the key you entered, or none), never
  its value. An environment key headed anywhere but `https://api.typesafe.ai` needs a second, explicit
  confirmation, and nothing is sent before it.
- **A stored key is bound to the endpoint it was stored for.** It is used only when the effective
  endpoint has the same origin (for a loopback server, the exact endpoint).
- `/system-one status` names the credential in use (`SYSTEMONE_API_KEY from the environment`,
  `TYPESAFE_API_KEY from the environment`, `stored key` or `none`), never its value.
- Redirects are refused, so a server cannot forward your prompt or key elsewhere.
- The key is never shown in status output, notices or session entries. If your user file can be read
  by other users, you get one notice to run `chmod 600` on it.

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
  consecutive failed turns (a turn with several requests counts once), or at once on 429 and 529,
  honoring `Retry-After`. When it has been open long enough, one probe request goes out first and
  the full set only follows if that works. A failed probe re-opens it with a longer back-off; a probe
  that reports nothing (the session ended, the configuration changed) is given back. You get one
  notice per error class per session.
- **Shutdown stops it.** Ending or replacing the session cancels requests still running, and nothing
  is recorded afterwards. So does changing the configuration (`/system-one setup` or `off`, or a
  different endpoint): a request made under the old one is cancelled, and whatever it returns is
  dropped, never counted against the new endpoint's circuit breaker.
- **Only prompts you type, in interactive sessions in Cratis repositories, are judged.** With no UI
  (print and JSON modes, and every subagent child process) nothing is asked. Neither is a prompt
  another extension injected with `sendUserMessage`, an RPC host's prompt (it may be automated), or a
  turn for which Pi reported no typed input. Text Pi wrapped around what you typed is skipped: a
  prompt built from `@file` arguments (a `<file name="…">` block anywhere in it) and any prompt whose
  text starts with `<`. So is a prompt whose text is no longer what this extension saw typed, because a
  later extension's `input` handler transformed it. `/system-one status` counts each skip. Repositories
  without `.cratis/ai.json` or `.cratis/ai.manifest.json` are skipped too. Pasted text is part of what
  you typed and is sent like the rest, up to the 1,200-character cap.
- **Only corpus skills** that Pi already loaded and the model may invoke are asked about (the
  project's managed `.cratis/ai/skills`, or the packaged corpus for the `@cratis/pi` copy). Skills you
  wrote yourself are never sent.
- **Limits.** At most 32 questions per request, sent concurrently. If more than 128 skills qualify,
  the call is skipped, not trimmed, and `/system-one status` says so.

## Reading the data

Each judged turn adds session entries of type `cratis-system-one`: the skills' probabilities (no
prompt), any failures, and, when the turn ends, which of **the skills that were asked about** the
model read during the turn (by name), plus a count of any other `SKILL.md` reads (a skill of your own,
or a corpus skill that was not asked about), which are never named. `/system-one report` turns that
into:

- turns judged,
- skills suggested at 0.5 or above, and how many of those the model then read,
- skills asked about, answered and read that were not suggested,
- skills that were asked about but got no answer (a request failed) and were read anyway, on their own line,
- other skill reads (not in the corpus, or not asked about that turn), counted apart so they cannot
  inflate the line above,
- backend latency p50 and p95,
- failures by class.

The kill criterion for the whole idea is simple: if models already load the relevant skills about
90% of the time, or a System One model adds under about 10 points of recall, no hint is built.

**Limitations.**

- A read is counted only when the model uses the `read` tool on a `SKILL.md`. A skill file read with
  `cat` in bash is **not counted**.
- A skill read in an earlier turn is still in the conversation; entries list those as `readEarlier`.
- Session data lives in Pi's session file, so it is as private as the session.
- **What counts as typed input is Pi's word, and this extension takes it.** It cannot see who or what
  produced text that reaches Pi as an interactive prompt. These are known and not detected:
  - Pi runs `input` handlers in load order, each seeing the previous one's output. A rewrite by an
    extension that loads **after** this one is detected (the prompt no longer equals the input this
    extension saw). One that loads **before** it is not: this extension sees the rewritten text as if
    you had typed it, for instance an `@path` already expanded into a file's contents.
  - `/tree` and `/fork` can put an earlier message, an extension's custom message or a hook's output
    back in the editor. If you resubmit it, it goes as an interactive prompt.
  - A custom editor component that another extension installs (`setEditorComponent`) can expand
    `@path` mentions into file contents before submit. Pi's default editor does not: there an
    `@path` stays a path.
  - An SDK host that embeds Pi with a UI and calls `session.prompt` without a source is labeled
    interactive.

  If you use extensions that rewrite or generate prompts, or such a host, and do not want their text
  judged, turn System One off or set `"skillRelevance": { "mode": "off" }` in your user file.

## Installation

`cratis ai install` copies this extension into `.cratis/ai/harnesses/pi/extensions/cratis-system-one`
and Pi loads it from `.pi/extensions`. The `@cratis/pi` package loads its own copy and **stands
down** when a managed copy exists in the project, so it is never registered twice. It needs only Node
built-ins, the global `fetch`, and Pi's own packages.

For a general-purpose tool gate and an "ask Jev" tool, use
[`@y0usaf/pi-jev`](https://github.com/y0usaf/pi-jev) rather than this extension.

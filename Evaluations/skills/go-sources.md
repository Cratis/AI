<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Go evaluation source map

The Go fixtures target **Chronicle.Go v0.9.1**, **Arc.Go v0.1.1** and
**Fundamentals.Go v0.3.2**. Assertion numbers below are their array positions in
`evals.json`, starting at 1. Product behavior is checked against the owning
product's tagged implementation and specifications, not a sibling checkout's
working tree or an unqualified README. Shared language/release advice is policy,
not a claim that every product implements every other product's capability.

These are evaluation inputs, not recorded model passes. The corpus gate checks
fixture shape; running an evaluator and exercising a real server are separate
checks. No Go implementation or community code snippet is copied into the fixtures.

## Shared version and policy facts

- Root paths and minimums: [Chronicle.Go v0.9.1 `go.mod`:1–9][chronicle-mod],
  [Arc.Go v0.1.1 `go.mod`:1–8][arc-mod], and
  [Fundamentals.Go v0.3.2 `go.mod`:1–3][fundamentals-mod]. All require Go 1.26;
  the first two require Fundamentals.Go v0.1.0, not v0.3.2.
- Minimum-version decisions: Chronicle.Go v0.9.1
  [`.cratis/ai/rules/go.md`:20–26][minimum-policy]. Language feature floors are
  shared Go policy: [range over functions (Go 1.23)][go123],
  [T.Context (Go 1.24)][go124], and
  [stable testing/synctest and WaitGroup.Go (Go 1.25)][go125]. The tagged
  Chronicle/Arc/Fundamentals roots' higher minimum does not prove an older
  consumer is compatible.
- Error compatibility: Chronicle.Go v0.9.1
  [`.cratis/ai/skills/go-errors-and-context/SKILL.md`:13–33][error-policy].
- Module migration/release policy: Arc.Go v0.1.1
  [`.cratis/ai/skills/go-release-modules/SKILL.md`:14–41,58–76][release-policy].
  The same workflow exists at [Chronicle.Go v0.9.1][chronicle-release] and
  [Fundamentals.Go v0.3.2][fundamentals-release]. This is a migration requirement,
  not a released `/v2` capability.

## Assertion coverage

| Skill / evaluation | Assertions | Tagged evidence |
| --- | --- | --- |
| Chronicle / 1 `older-go-minimum` | 1 | The three `go.mod` sources above |
| Chronicle / 1 | 2 | Minimum-version policy above |
| Chronicle / 1 | 3 | Go release-note feature floors above |
| Chronicle / 2 `borrowed-connection-and-wrapped-errors` | 1–2 | Chronicle.Go v0.9.1 [`options.go`:154–159][borrow]; [`client_shutdown.go`:13–27][shutdown]; [`client.go`:123–147][borrow-validation] |
| Chronicle / 2 | 3 | Error compatibility policy above; [`client.go`:123–147][borrow-validation] wraps ErrInvalidConfiguration |
| Chronicle / 2 | 4 | [`client_shutdown.go`:13–35,67–74][shutdown] |
| Chronicle / 3 `canceled-read-model-stream` | 1–2 | Chronicle.Go v0.9.1 [`readmodels/subscription.go`:59–94,112–143,198–208][subscription] |
| Chronicle / 3 | 3 | [`readmodels/subscription.go`:17–23,59–62][subscription] |
| Chronicle / 4 `early-iterator-exit` | 1–3 | Chronicle.Go v0.9.1 [`readmodels/subscription.go`:59–108][subscription], including single-consumer and Done/Close contracts |
| Chronicle / 5 `ambiguous-append-retry` | 1–2 | Chronicle.Go v0.9.1 [`eventsequences/result.go`:47–63,84–118][append-result]; [`eventsequences/sequence.go`:68–77,111–157][append] |
| Chronicle / 5 | 3 | [`eventsequences/sequence.go`:68–74][append]; error/retry policy above |
| Chronicle / 5 | 4 | [`eventsequences/result.go`:47–55][append-result] |
| Arc / 1 `head-and-json-wire-contract` | 1 | Arc.Go v0.1.1 [`query_endpoint.go`:48–52,108–119][query-endpoint]; [`ingress.go`:220–239][publish]; [`observable_lifecycle_test.go`:184–238][head-spec] |
| Arc / 1 | 2 | [`ingress.go`:220–239][publish]; Fundamentals.Go v0.3.2 [`documentation_examples_test.go`:35–52][concept-example] demonstrates explicit JSON names |
| Arc / 1 | 3 | Arc.Go v0.1.1 [`queries/request_query.go`:92–145][query-json]; [`internal/httptransport/body.go`:15–51][body] |
| Arc / 1 | 4 | Arc.Go v0.1.1 [`Documentation/parity.md`:30–65][http-parity] explicitly excludes HEAD and other surfaces from the paired checkpoint |
| Arc / 2 `cancellation-and-iterator-cleanup` | 1 | Arc.Go v0.1.1 [`observable/source.go`:17–31][source]; [`queries/registration.go`:64–78][registration] |
| Arc / 2 | 2–3 | [`observable/adapters.go`:117–139][iterator]; [`observable/source.go`:17–44,105–122][source] |
| Arc / 2 | 4 | [`observable/source_test.go`:400–422][iterator-spec]; [tagged testing policy:17–27][testing-policy] calls for synchronization, not sleep; a unit test is not network evidence |
| Arc / 3 `v2-import-and-release-migration` | 1 | The three `go.mod` sources above |
| Arc / 3 | 2–4 | The tagged release-module policies above; Chronicle.Go v0.9.1 [`Documentation/module-policy.md`:48–53][module-policy] explicitly rejects `/v2` under its current module grammar |
| Fundamentals / 1 `older-consumer-minimum` | 1,3 | The three `go.mod` sources above |
| Fundamentals / 1 | 2 | Minimum-version policy above |
| Fundamentals / 2 `wrapped-concept-error-compatibility` | 1–2 | Fundamentals.Go v0.3.2 [`concepts/underlying.go`:31–40,68–91][underlying]; [`concepts/underlying_test.go`:30–44][wrapped-spec] |
| Fundamentals / 2 | 3 | [`concepts/check_json.go`:15–30][check-json]; [`concepts/underlying.go`:93–103][underlying] |
| Fundamentals / 3 `named-uuid-wire-compatibility` | 1 | Fundamentals.Go v0.3.2 [`concepts/uuid.go`:15–18][uuid]; [`documentation_examples_test.go`:15–28][concept-example] |
| Fundamentals / 3 | 2–3 | [`concepts/uuid.go`:15–34,48–51,89–116][uuid] |
| Fundamentals / 3 | 4 | [`concepts/concept_codec_test.go`:60–145][codec-spec] exercises text/JSON/map keys and failure-atomic decoding |

[chronicle-mod]: https://github.com/Cratis/Chronicle.Go/blob/v0.9.1/go.mod#L1-L9
[arc-mod]: https://github.com/Cratis/Arc.Go/blob/v0.1.1/go.mod#L1-L8
[fundamentals-mod]: https://github.com/Cratis/Fundamentals.Go/blob/v0.3.2/go.mod#L1-L3
[minimum-policy]: https://github.com/Cratis/Chronicle.Go/blob/v0.9.1/.cratis/ai/rules/go.md#L20-L26
[go123]: https://go.dev/doc/go1.23#language
[go124]: https://go.dev/doc/go1.24#testingpkgtesting
[go125]: https://go.dev/doc/go1.25#standard-library
[error-policy]: https://github.com/Cratis/Chronicle.Go/blob/v0.9.1/.cratis/ai/skills/go-errors-and-context/SKILL.md#L13-L33
[release-policy]: https://github.com/Cratis/Arc.Go/blob/v0.1.1/.cratis/ai/skills/go-release-modules/SKILL.md#L14-L76
[chronicle-release]: https://github.com/Cratis/Chronicle.Go/blob/v0.9.1/.cratis/ai/skills/go-release-modules/SKILL.md#L14-L76
[fundamentals-release]: https://github.com/Cratis/Fundamentals.Go/blob/v0.3.2/.cratis/ai/skills/go-release-modules/SKILL.md#L14-L76
[borrow]: https://github.com/Cratis/Chronicle.Go/blob/v0.9.1/options.go#L154-L159
[borrow-validation]: https://github.com/Cratis/Chronicle.Go/blob/v0.9.1/client.go#L123-L147
[shutdown]: https://github.com/Cratis/Chronicle.Go/blob/v0.9.1/client_shutdown.go#L13-L74
[subscription]: https://github.com/Cratis/Chronicle.Go/blob/v0.9.1/readmodels/subscription.go#L59-L208
[append-result]: https://github.com/Cratis/Chronicle.Go/blob/v0.9.1/eventsequences/result.go#L47-L118
[append]: https://github.com/Cratis/Chronicle.Go/blob/v0.9.1/eventsequences/sequence.go#L68-L157
[query-endpoint]: https://github.com/Cratis/Arc.Go/blob/v0.1.1/query_endpoint.go#L48-L119
[publish]: https://github.com/Cratis/Arc.Go/blob/v0.1.1/ingress.go#L220-L239
[head-spec]: https://github.com/Cratis/Arc.Go/blob/v0.1.1/observable_lifecycle_test.go#L184-L238
[query-json]: https://github.com/Cratis/Arc.Go/blob/v0.1.1/queries/request_query.go#L92-L145
[body]: https://github.com/Cratis/Arc.Go/blob/v0.1.1/internal/httptransport/body.go#L15-L51
[http-parity]: https://github.com/Cratis/Arc.Go/blob/v0.1.1/Documentation/parity.md#L30-L65
[source]: https://github.com/Cratis/Arc.Go/blob/v0.1.1/observable/source.go#L17-L122
[registration]: https://github.com/Cratis/Arc.Go/blob/v0.1.1/queries/registration.go#L64-L78
[iterator]: https://github.com/Cratis/Arc.Go/blob/v0.1.1/observable/adapters.go#L117-L139
[iterator-spec]: https://github.com/Cratis/Arc.Go/blob/v0.1.1/observable/source_test.go#L400-L422
[testing-policy]: https://github.com/Cratis/Arc.Go/blob/v0.1.1/.cratis/ai/skills/go-testing/SKILL.md#L17-L27
[module-policy]: https://github.com/Cratis/Chronicle.Go/blob/v0.9.1/Documentation/module-policy.md#L48-L53
[underlying]: https://github.com/Cratis/Fundamentals.Go/blob/v0.3.2/concepts/underlying.go#L31-L103
[wrapped-spec]: https://github.com/Cratis/Fundamentals.Go/blob/v0.3.2/concepts/underlying_test.go#L30-L44
[check-json]: https://github.com/Cratis/Fundamentals.Go/blob/v0.3.2/concepts/check_json.go#L15-L30
[uuid]: https://github.com/Cratis/Fundamentals.Go/blob/v0.3.2/concepts/uuid.go#L15-L116
[concept-example]: https://github.com/Cratis/Fundamentals.Go/blob/v0.3.2/documentation_examples_test.go#L15-L52
[codec-spec]: https://github.com/Cratis/Fundamentals.Go/blob/v0.3.2/concepts/concept_codec_test.go#L60-L145

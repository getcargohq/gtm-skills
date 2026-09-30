# The GTM profile method: what changed in the port

`infra/agents/gtm-profile-method.ts` carries the method the bootstrap runs as its step 3. It was
ported from the system instructions of a public custom GPT ("Custom datapoints & signals", domain
in, first hypothesis of target market, users, buyers, use cases, competitors, custom attributes and
live signals out), and it is verbatim in substance. Every line that differs is listed here, with
the reason, so a reader checks the port rather than trusts it.

| Original                                                                                                                                                                          | Port                                                                                                                                                                                                                              | Why                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| "You are the Head of GTM Operations at the company identified by the domain provided by the user."                                                                                | "... identified by the domain provided."                                                                                                                                                                                          | There is no user at this step. The bootstrap fills `{{domain}}` from the workspace and the repository (step 0 of its prompt), and the operator only sees the domain read back.                                                       |
| "Prioritize signals from the last 6–9 months."                                                                                                                                    | "... last 6 to 9 months."                                                                                                                                                                                                         | The repository's copy rule: no dashes in prose. Same window.                                                                                                                                                                         |
| No rule on how a value in the Company GTM Profile is labelled beyond "If information is unclear, state that it is inferred and explain the uncertainty."                          | Added under OUTPUT: every value in the profile ends with one of `(confirmed: <url>)`, `(inferred: <from what>)`, `(unknown: <what would settle it>)`.                                                                             | The labels are what become the graph's `[R]`, `[I]` and `[TR]` tags. The original left the form to the model; a machine-readable label per value is what lets the bootstrap tag every sentence it writes without re-deriving anything. |
| KNOWLEDGE BASE GUIDANCE: "Use the attached knowledge files as supporting methodology and examples", naming the Cargo article PDF and a second document that is the same article. | Replaced by METHODOLOGY: the public URL of the article, with the original's own rules kept (methodology not evidence, never cite it for a company fact, current public evidence wins, never assume an example applies).            | There are no attached files in a harness sandbox. The two files were one article, and it is public; the rules about how to use it are the original's, restated for a URL instead of an attachment.                                   |
| Curly apostrophes in "company’s", "employee’s".                                                                                                                                    | Straight apostrophes.                                                                                                                                                                                                             | The prompt is a template literal; nothing else changed in those lines.                                                                                                                                                               |

Nothing else moved: the research list, the default assumption (net-new prospecting), the attribute
and signal definitions and their per-item formats, the developer-tool attribute list, the usage
ladder (individual, team, pilot, approved, standard, historical, unknown), the output structure and
the quality rules are the original's.

## Where its output goes

- The profile itself: `outputs/<date>-context-bootstrap/README.md`, the receipt the operator reads
  before the three-line confirmation.
- Likely ICP, primary users, likely buyers, likely competitors: the three lines of step 5, and the
  seeds of `icp/`, `persona/`, `alternative/`.
- Live sales signals: one `signal/` candidate each, `confidence: hypothesis`, detection written
  operationally from "How it can be detected".
- Custom attributes: the `How to identify` section of `icp/`, and the account-scoring cookbook's
  rubric if that is installed.
- Its `inferred` and `unknown` labels: the `[I]` and `[TR]` tags on every sentence the bootstrap
  writes from it.

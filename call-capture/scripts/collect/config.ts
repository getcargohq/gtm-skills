/**
 * The two things this collector needs a project to decide, in code.
 *
 * Both were environment variables declared in the agent's `repository.env`,
 * and neither is a secret — they are choices. Choices belong here for three
 * reasons:
 *
 * - **The compiler checks them.** `RECORDER` is typed against the registry's
 *   keys, so a slug that is not a recorder fails `npm run typecheck`. As an
 *   environment variable the same typo was discovered by a 07:00 run, which
 *   then reported a clean, empty, successful-looking morning.
 * - **Changing them is lighter, not heavier.** The harness clones this
 *   repository on every run, so an edit here takes effect on the next run
 *   after it merges. The agent's env is part of the deployed spec, so changing
 *   a value there needs `cargo-ai cdk deploy`.
 * - **They are reviewable.** Which recorder the company records on, and which
 *   domain is "us", are the two decisions everything downstream is shaped by.
 *   In a diff they get read; in a deployed environment variable nobody sees
 *   them again.
 *
 * The credential is the opposite case and goes the opposite way: it is a
 * secret, it must not be in git, and it lives in the workspace's environment
 * variables, which the harness inherits in full. One rule covers both —
 * choices in code, secrets in the workspace — and nothing is in two places.
 */
import type { RecorderSlug } from "./recorders";

/**
 * PLACEHOLDER — which recorder records your calls.
 *
 * One of the keys in `recorders/index.ts`; nine ship, and
 * `npx tsx scripts/call-capture/collect/calls.ts --list` prints them with
 * what each wants for a credential. `--recorder=<slug>` overrides this for a
 * single run, which is how you try another one without editing anything.
 *
 * A wrong-but-valid slug is the thing to be careful about: it reads the wrong
 * vendor's API perfectly successfully, captures nothing, and reports a clean
 * empty run every morning. The compiler cannot catch that one — a reviewer
 * can, which is the other reason this line is in the repository.
 */
export const RECORDER: RecorderSlug = "avoma";

/**
 * PLACEHOLDER — your own email domain.
 *
 * How an internal call is told from a customer one, for every recorder alike.
 * It lives here rather than in an adapter because it has to mean the same
 * thing whoever recorded the call: most recorders do not flag
 * internal-versus-external at all, and the ones that do disagree with each
 * other — Avoma's `is_internal` is false on every meeting in some workspaces,
 * including all-internal ones.
 *
 * Leave it as the example and every standup is captured as an account.
 */
export const INTERNAL_DOMAIN = "example.com";

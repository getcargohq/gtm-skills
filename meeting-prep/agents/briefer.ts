import { defineAgent } from "@cargo-ai/cdk";

import { cargoDb } from "../connectors/cargo";
import { linkedin } from "../connectors/linkedin";
import { openai } from "../connectors/openai";
import { slack } from "../connectors/slack";
import { accounts } from "../models/accounts";
import { contacts } from "../models/contacts";
import { agentsFolder } from "../folders/gtm";
import { hubspot } from "../connectors/hubspot";
import { meetingBriefs } from "../models/briefs";

// The briefing agent. Wakes every morning, finds today's calls, and posts one
// skimmable card per meeting before it starts.
//
// Generalized from the "Discovery Call Briefer" running in production at
// Unikraft, so the shape below is not theoretical: it is what survived contact
// with real reps.
//
// THREE THINGS MAKE OR BREAK THIS AGENT, and they are all in the prompt:
//
// 1. The dedupe. An agent that posts a duplicate card every time it runs gets
//    muted within a week. It checks the meeting_briefs ledger before posting and
//    appends after. (The original read Slack history for a marker; Cargo's Slack
//    integration exposes only postMessage, no read action, so the ledger model
//    replaces it. It is the sturdier mechanism: it survives a deleted message.)
//
// 2. No fabrication, especially LinkedIn URLs. A made-up profile link is worse
//    than no link: the rep clicks it in front of the prospect.
//
// 3. The company context block (below). It is what makes the call tips sharp
//    rather than generic. Write it with the care you would give positioning copy.
export const briefer = defineAgent("meeting-briefer", {
  color: "purple",
  connector: openai,
  languageModel: "gpt-4o", // PLACEHOLDER: a reasoning-grade model. Sonnet-class works well here.
  temperature: 0.3,
  maxSteps: 40,
  capabilities: ["webSearch", "memory"],
  folder: agentsFolder,

  systemPrompt: [
    "You brief the sales team before their calls. Every morning you find today's meetings, research them, and post one card per meeting to Slack, then mirror it by email.",
    "",
    "=== COMPANY CONTEXT (PLACEHOLDER: rewrite this block for your company) ===",
    "What we are: <one paragraph. What you sell, to whom, and the outcome you deliver.>",
    "What we never claim: <the things a rep must not promise. This is what keeps a call tip honest.>",
    "Best-fit workloads and angles: <where you genuinely win, and the angle that lands there.>",
    "=== END COMPANY CONTEXT ===",
    "",
    "This block is the difference between a sharp call tip and a generic one. Every tip you write must be defensible against it.",
    "",
    "YOUR RUN, in order:",
    "",
    "1. FIND TODAY'S MEETINGS. Search the CRM for meetings of the target type in today's window. Use the CRM search action with the meeting object and a time filter.",
    "",
    "2. DEDUPE BEFORE YOU RESEARCH. For each meeting, check the meeting_briefs model for its meeting id. If it is already there, SKIP IT ENTIRELY: do not research it, do not post it. Re-running you must never produce a second card for the same meeting. Research costs credits, so check first, not after.",
    "",
    "3. If there are NO un-briefed meetings today, post exactly ONE line saying there are no calls today, and stop. Do not post an empty card. Do not post the same 'no calls' line twice in one day (the ledger applies here too).",
    "",
    "4. RESEARCH each remaining meeting. Resolve the attendees and the company, then gather, in parallel where you can:",
    "   - The company: firmographics, funding, and recent news. Use the business database and web search.",
    "   - Each attendee: one line on who they are and what they own. Enrich their LinkedIn profile.",
    "     NEVER fabricate a LinkedIn URL. If you cannot find a real one, say 'no profile found'. A made-up link is worse than no link: the rep will click it in front of the prospect.",
    "   - Engagement history: what has this person or account actually done? Email replies and LinkedIn comments are the warmest signals there are. Quote them VERBATIM, do not paraphrase.",
    "",
    "5. POST ONE CARD PER MEETING, in this exact format:",
    "   *When* - the time",
    "   *Company* - name, size, stage, one line on what they do",
    "   *Recent* - the most relevant recent news or funding event, or omit the line if there is none",
    "   *Who's joining* - one line per attendee: name, title, real LinkedIn URL or 'no profile found'",
    "   *Signals* - the single warmest signal per attendee, quoted verbatim. Omit an attendee with no signal rather than inventing one.",
    "   *Call tip* - 2 to 4 sentences, grounded in the research above and defensible against the company context block. End with ONE probing question the rep can actually ask.",
    "",
    "6. RECORD what you briefed: append the meeting id to meeting_briefs with the timestamp. Do this AFTER a successful post, so a failed post can be retried.",
    "",
    "7. MIRROR the same briefing by email to the configured recipients.",
    "",
    "RULES:",
    "- Never invent a fact, a quote, a person, or a URL. A thin card built from real facts beats a rich card built from guesses.",
    "- If research turns up nothing for a meeting, post the card anyway with what you do have and say plainly what you could not find.",
    "- The call tip is the whole point. A tip that could apply to any company is a failed tip: rewrite it until it could only apply to this one.",
  ].join("\n"),

  uses: [
    // Read the CRM for today's meetings.
    hubspot.actions.searchRecords,
    // The dedupe ledger. NOT read-only: the agent appends to it after posting.
    { ref: meetingBriefs, readOnly: false },
    // Who and where: the account and the people.
    { ref: accounts, readOnly: true },
    { ref: contacts, readOnly: true },
    // Company research.
    cargoDb.actions.matchBusiness,
    cargoDb.actions.enrichBusinessFirmographics,
    cargoDb.actions.enrichBusinessFundingAndAcquisitions,
    // Attendee research.
    linkedin.actions.enrichProfile,
    linkedin.actions.findProfileUrl,
    // Delivery.
    slack.actions.postMessage,
  ],

  triggers: [
    {
      type: "cron",
      // PLACEHOLDER: early enough to land before the first call of the day.
      cron: "0 7 * * 1-5",
      text: "Find today's calls, brief the ones not already briefed, and post one card each.",
    },
  ],

  evaluator: {
    rubric:
      "Was there exactly one card per meeting and zero duplicates on a re-run? Was every LinkedIn URL real (never fabricated)? Were signals quoted verbatim? Could the call tip only apply to this company, rather than any company?",
    threshold: 0.8,
  },
});

import { defineConnector } from "@cargo-ai/cdk";

// The calendar the meetings are booked in, and the source of the trigger: one
// event created, moved or cancelled wakes the briefer once.
//
// Two ways to connect it, both chosen in the Cargo UI, so this declaration
// binds rather than creates (`default: true`):
//   - domain-wide delegation: Cargo's service account reads every user's
//     calendar in the Google Workspace. The Workspace admin authorizes Cargo's
//     client id once, in the Google Admin console, for `calendar.readonly` and
//     `admin.directory.user.readonly`, and enters the domain and an admin email
//     on the connector. This is what covers the whole team, not only the person
//     who installed it.
//   - OAuth: one user's own calendar, nothing to authorize at the admin level.
//
// The briefer only reads through it: the trigger and `getEvent`.
export const googleCalendar = defineConnector("google_calendar", {
  integration: "googleCalendar",
  default: true,
});

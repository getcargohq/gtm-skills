# The digest

One Slack post a week, after the scans are recorded and the pull request is open.

```text
:robot_face: *Agent readiness: <ISO week>*
*<our domain>*: <score>/100 (<grade>), <+n | -n | no change | baseline> since last week. <Ora report link>
• Fixed: <check names, or "nothing">
• Newly failing: <check names, or "nothing">
*Competitors*
• <domain>: <score> (<grade>), <change>
*Where a competitor is ahead*
• <check name>: passes at <competitor domains>
*Fix pull request*: <link, or "none this week" and why>
*To do by hand*
• <check name>: <Ora's recommendation, one line>
```

## Rules for each line

- **Every number is Ora's.** Score, grade and check status come from this week's result; the change
  is against last week's `readiness_scans` row. The first week is the baseline and lists no change.
- **Check names, not ids**, and Ora's words for each recommendation. A reader acts on "Markdown
  link alternate", not on `markdown-link-alternate`.
- **Where a competitor is ahead** lists checks failing for us that a competitor passes in this
  week's scan. A check that does not apply to them is not a pass.
- **To do by hand** is at most three fixes from our topFixes that no change to the site's source can
  make: brand search, registry and directory listings, Wikipedia, packages, an API or an MCP server.
- **A partial or skipped scan says so** on its domain's line. Silence reads as a clean week.
- **An unreached domain says so instead of a score.** When Ora could not fetch the homepage, our line
  reads "Ora could not reach <finalUrl>", and the one to-do is to serve or forward that URL. No
  comparison and no pull request: the score measured nothing.
- A section with nothing in it is left out, except the first line.

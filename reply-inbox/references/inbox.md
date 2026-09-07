# The hosted inbox

The queue is mailbox **threads**, not messages. Inbound replies are **events**
on those threads (`kind: replied`). The app lists threads, then loads messages
and replied-events for the open conversation.

A reply from the app is native `sendEmail`:

- `mailboxUuid` is the thread's mailbox
- `to` is the thread's `toEmail`
- `subject` keeps a leading `Re:`
- `inReplyTo` is the latest inbound `Message-ID`, or the last outbound if
  none is stored
- `references` is every RFC id on the thread, oldest first

LinkedIn is a separate page because Cargo does not store LinkedIn
conversations. `messageProfile` sends. The other side of that thread stays
on LinkedIn.

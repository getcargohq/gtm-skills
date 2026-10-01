# Design-system capture

The output is `context/global/design.md` (frontmatter `title` and `description`), written so an
agent with no memory of the capture can build a new page from it.

## Evidence, best first

1. An existing company `design.md`, brand guide, Figma or Storybook.
2. Authorized source: stylesheets, component code, original font and logo files.
3. The rendered public site at desktop and mobile widths: computed styles, loaded assets, visible
   states. Repeated values suggest a scale; they do not recover token names or unseen components.

Another company's guide is a format reference, never this company's brand. When the guide and the
site disagree, record both and ask which governs.

## What to record

- **Scope**: surface, capture date, source pages, widths, and whether the direction is approved.
- **Principles**: the few choices that make the brand recognizable.
- **Tokens**: type, color, spacing, content widths, radii, shadows, breakpoints and themes that
  actually appear in the evidence.
- **Components**: navigation, buttons, cards, forms, footer, with the states that were seen.
- **Assets**: fonts, logos and imagery, with their source and where they live in the app.
- **Unknowns**: missing pages, fonts and states, and the accommodation chosen.

Tag each rule **observed**, **inferred** or **proposed**. A company with no system gets a proposed
direction from its brief, labeled as proposed.

## How the app uses it

Map the tokens onto the shadcn/ui variables in `app/globals.css` (colors, radius, fonts) and the
components in `components/ui/`, and link those files from the guide so each value lives in one
place. Check the mapping in the local preview with headings, body text, navigation, buttons, a card
and a form, compared with the source at the same widths. Screenshots are evidence, never build
inputs, and publishing a `/design.md` on the site is a separate decision.

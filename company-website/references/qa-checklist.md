# Company Website QA

Use this during implementation and release review. Mark relevant checks
**passed**, **failed**, **unverified**, or **not applicable** with a reason.
Record the command or browser action, URL/path, and evidence for each result.
Do not turn an unrun check into a pass.

## Before implementation

- [ ] Company, audience, offering, goal, pages, branding, CTA, workspace, and
      creation/recreation/redesign/update mode are established.
- [ ] The user approved the concrete brief and sitemap. Source pages and assets
      are within the agreed scope; inaccessible content and unknown behavior are
      listed. For updates, the changed pages and expected effect are clear.
- [ ] Copy distinguishes supported company facts from proposals. Fictional seed
      material, unverified claims, and test fixtures are excluded from public copy.
- [ ] Installed CLI help and CDK types support the chosen scaffold and app
      declaration. Exact command syntax comes from the Cargo skills and the
      installed CLI. A top-level help response does not validate a subcommand.

## Package, source, and infrastructure

- [ ] `context/global/design.md` records the design's scope, sources, and
      observed/inferred/proposed rules. Existing guides and rendered-source
      conflicts are resolved explicitly. A new brand's choices are labeled as
      proposals until approved.
- [ ] The guide links to actual tokens and authorized assets. A component
      sample uses those same values, and reference comparisons cover matching
      desktop/mobile viewports and relevant states.

- [ ] The app builds from its own package root with its committed lockfile.
      Reproduce Cargo's documented build, including any required prebuild step;
      do not rely on files present only on the developer's machine.
- [ ] `defineApp` points to the app package. The CDK discovers the declaration
      without importing browser code as infrastructure. Applicable repository
      lint/typecheck and app checks pass, or baseline failures are documented.
- [ ] App source changes appear in the CDK plan. Inspect whether the plan uses
      local or workspace-held state; do not assume every plan is offline.
- [ ] Assets survive the installed uploader's actual encoding. The current CDK
      uses text payloads: reconcile any raw binary assets before release, preserve
      authorized originals outside the bundle, and compare the adapted result.
- [ ] CI includes the app source paths and uses the actual state location.
      The installed version may resolve state differently from an older workflow;
      a plan or state-path mismatch is unresolved until reviewed and corrected.
- [ ] App/resource identifiers remain stable for updates. Existing state is
      preserved; adoption is explicit when an existing app is absent from state.
- [ ] Browser assets, source maps, network requests, and generated environment
      output contain no secrets or private workspace data. Inspect the app bundle,
      not just git. Frontend build variables remain public even when their values
      were supplied through a secret helper.

## Browser and content checks

- [ ] Exercise every changed page at representative desktop and mobile sizes
      (for example, 1440 x 900 and 390 x 844); record actual dimensions. Check
      overflow, typography, spacing, images, and small-screen navigation.
      Include intermediate widths around the source's layout breakpoints; matching
      desktop and phone views can miss an overflowing tablet or laptop layout.
- [ ] Test navigation, CTAs, internal/external links, browser back/forward,
      direct URL entry, refresh on nested routes, and an unknown route. Check
      redirects and anchors where required. Verify deployed routing separately.
- [ ] Check images and fonts load, asset paths survive the production build,
      and image alternatives convey meaning. Decorative images have empty alt text.
- [ ] Check keyboard navigation, visible focus, menu/dialog focus behavior,
      form labels and error association, heading structure, landmarks, and contrast.
      An automated accessibility scan alone does not complete this check.
- [ ] Verify per-page title, description, canonical URL, social metadata,
      robots directives, and sitemap where required. Use the actual approved live
      origin, not an invented URL. Inspect initial HTML when indexing or link
      previews require it; changing metadata only in JavaScript may not satisfy
      the requirement. Record any rendering or hosting limitation.
- [ ] Load public pages in a clean browser session with no Cargo login,
      credentials, or workspace membership. Look for OAuth redirects, workspace
      controls, stalled authentication loaders, and unnecessary Cargo API calls.
- [ ] Check the browser console and network for failed requests and visible
      runtime errors. Record remaining errors and their user impact.

## Forms and recreation

- [ ] Form destination, backend, fields, and expected behavior are approved.
      Check empty/invalid input, submission, duplicate clicks, loading, failure,
      and success. Test the agreed backend with clearly labeled synthetic data
      only when authorized; record evidence of receipt. Identify mocked or untested
      delivery explicitly and keep unsupplied integrations disconnected.
- [ ] For recreation, compare source and local screenshots at matching pages,
      viewports, and interaction states. Check navigation, typography, spacing,
      assets, responsive behavior, and copy. Separate observed matches, approved
      differences, unavailable references, and unknown backend behavior.
      Synchronize animation timing for comparisons and disclose that normalization;
      test actual motion separately. Report inherited source defects separately from
      reconstruction defects: pixel equality does not establish working CTAs, form
      delivery, accessibility, or release readiness.

## Release and handoff

- [ ] The user has seen a local preview, QA results, and unresolved limitations.
      Release approval covers the exact workspace/app and intended live changes.
- [ ] Current app, promoted deployment, actual state binding, and reviewed plan
      agree. The previous successful deployment or recoverable source revision is
      recorded before replacement. Production writes follow repository rules.
- [ ] Requested custom-domain support is verified using current Cargo
      documentation/API/CLI. Do not treat a domain purchase or sending-domain DNS
      resource as proof that hosting supports a custom website domain. If support
      is absent or unverified, say so. Any domain/DNS change has its own approval.
- [ ] A real release completed successfully and the promoted deployment matches
      the intended version. Use the actual returned live URL, then test anonymous
      access, nested-route refresh, assets, and agreed form behavior there.
- [ ] Handoff includes actual verification results, unverified items, supported
      update/recovery instructions, and the append-only output record. If not
      published, label it as a local preview or prepared CI handoff.

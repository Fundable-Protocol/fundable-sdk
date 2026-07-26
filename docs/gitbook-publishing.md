# Publishing this documentation with GitBook

The repository is ready for GitBook Git Sync:

- `.gitbook.yaml` selects `docs/` as the content root;
- `docs/README.md` is the documentation homepage;
- `docs/SUMMARY.md` defines the public navigation;
- `pnpm docs:check` verifies local Markdown targets.

## One-time organization setup

A Fundable GitBook organization owner must:

1. Create or select the public SDK documentation space.
2. Install or authorize the GitHub integration for
   `Fundable-Protocol/fundable-sdk`.
3. Enable Git Sync for the repository's `main` branch.
4. Confirm that GitBook detects `.gitbook.yaml` at the repository root.
5. Configure the published site title, icon, social preview, and public access.
6. Publish the site and record its canonical HTTPS URL.

GitBook changes should normally be proposed through repository pull requests.
If bidirectional editing is enabled, protect `main` and require GitBook-originated
changes to pass the same CI checks as code-originated changes.

## After the first publication

Replace the package's GitHub `homepage` value with the canonical documentation
URL, then add the same URL to:

- the repository About section;
- the top of the repository README;
- the npm package page through the next release;
- the stable GitHub release notes.

Verify every navigation item, code block, table, and external link on desktop
and mobile. Record that verification in the
[delivery checklist](delivery-checklist.md).

## Release ownership

Publishing GitBook content is separate from publishing npm. Documentation may
deploy on every merge to `main`, while npm only publishes from an approved
version tag. A stable SDK release must link to documentation that describes
that exact package and compatible contract deployment.

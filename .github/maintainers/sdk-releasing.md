# Release process

Fundable SDK releases are produced from reviewed commits on `main`. npm
publishing is automated by a version tag and uses trusted publishing; no npm
token belongs in the repository.

## Stable-release gate

Before choosing a stable version:

- every automated item in the
  [delivery checklist](sdk-delivery-checklist.md) is
  checked;
- the SDK API and compatible contract release are approved;
- the public GitBook site is live and linked from repository metadata;
- CI is green on the exact release commit;
- the testnet smoke suite passes against the recorded deployment;
- `stellar_client` is green against the release candidate.

Do not publish a stable package solely because the prerelease is usable.
Stable means the package, documentation, examples, compatibility statement,
and operational ownership are ready together.

## Prepare the release pull request

1. Select the semantic version. The first stable candidate is expected to be
   `0.1.0` only if maintainers approve the current public API.
2. Update `package.json`, the SDK `VERSION` export, and `pnpm-lock.yaml` to the
   same version.
3. Replace prerelease warnings and pinned example versions where applicable.
4. Add release notes describing features, contract compatibility, known
   limitations, and migration requirements.
5. Run:

   ```bash
   pnpm verify
   pnpm package:verify
   pnpm test:testnet
   ```

6. Open a pull request and require the normal CI review.

## Publish

After the release pull request is merged:

1. Create the annotated tag `v<package-version>` on the reviewed `main`
   commit.
2. Push the tag.
3. Confirm the GitHub publish workflow succeeds.
4. Confirm npm shows the exact version under `latest`. A version containing a
   hyphen is intentionally published under `next`.
5. Create the GitHub release from the same tag.
6. Verify a fresh external project can install the registry version, not only
   the local tarball.

The workflow rejects a tag that does not exactly match `package.json`.

## Post-release

- verify npm, GitHub, GitBook, README, contract provenance, and examples link
  to the compatible versions;
- monitor install and RPC errors from Fundable-owned applications;
- reconcile indexed test transactions in the backend;
- create follow-up issues for deferred EVM adapter work without changing the
  stable shared boundary.

If publishing succeeds but a critical package defect is found, do not overwrite
the npm version. Publish a corrected patch and deprecate the affected version
with a clear replacement message.

# Troubleshooting and versioning

## Common problems

### A capability is undefined

`router`, `streamNft`, and `paymaster` are optional because their contract IDs
are optional. Add the correct deployed address to the client configuration and
restart the application.

### Address validation fails

Use a valid Stellar account (`G...`) or contract (`C...`) address for the
specific parameter. Confirm the address belongs to the configured network and
was not truncated by an environment loader.

### Simulation fails

Confirm:

- the RPC URL serves the configured network passphrase;
- the contract IDs belong to the same deployment;
- the source account exists and has enough XLM for fees and reserves;
- token balances and allowances satisfy the operation;
- timestamps and stream amounts satisfy contract rules;
- the app is using bindings compatible with the deployed contract release.

Preserve `FundableError.cause` in restricted diagnostic logs, but show users a
safe action-oriented message.

### A transaction expires or becomes invalid

Rebuild and re-simulate the invocation against current ledger state. Do not
reuse an old signature on a modified transaction.

### Amounts are rounded

Do not pass JavaScript `number` values for token amounts. Parse user input with
`parseUnits` and format results with `formatUnits`.

## Versioning policy

The SDK follows semantic versioning:

- patch releases fix behavior without changing supported public inputs;
- minor releases add backward-compatible capabilities;
- major releases may change public types or behavior.

Until `1.0.0`, minor `0.x` releases may contain breaking changes. Prerelease
versions such as `0.1.0-alpha.3` are published under npm's `next` tag and must
not be treated as stable.

Pin an exact prerelease in production:

```json
{
  "dependencies": {
    "@fundable/sdk": "0.1.0-alpha.3"
  }
}
```

Every release must align:

- npm package version and dist-tag;
- Git tag and GitHub release;
- documentation version;
- generated binding provenance;
- compatible contract release and deployment addresses.

Review [Generated Stellar bindings](generated-bindings.md) before upgrading an
application that targets an existing contract deployment.

# GitHub Rulesets

These files keep the repository's GitHub governance policy version-controlled.

They are importable ruleset recipes, intentionally stripped of export-only repository metadata such as a ruleset `id`, `source`, and `source_type`.

## protect-main.json

Targets the repository default branch using GitHub's portable `~DEFAULT_BRANCH` selector.

It prevents:

- deleting the default branch;
- non-fast-forward / force-push updates.

It intentionally does **not** add pull-request or required-status-check policy yet. Those rules should only be added after the exact contributor workflow and required CI checks are stable.

## protect-release-tags.json

Targets version tags matching:

```text
refs/tags/v*
```

Examples:

- `v0.3.0`
- `v0.3.1`
- `v1.0.0`

It prevents:

- updating an existing release tag;
- deleting an existing release tag;
- force-push / non-fast-forward changes.

Tag creation remains allowed so maintainers can publish future versions.

## Import into GitHub

In the repository:

```text
Settings
→ Rules
→ Rulesets
→ New ruleset
→ Import a ruleset
```

Choose the relevant JSON file.

Review the imported targeting and rules before saving, then set enforcement to `Active`.

## Source of truth

These files document the intended ruleset configuration, but GitHub remains the enforcement system.

If a ruleset is changed manually in GitHub, export it and reconcile the JSON here so repository documentation does not drift from actual enforcement.

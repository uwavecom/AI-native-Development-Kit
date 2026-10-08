# First protected action in a fresh Node.js project

This kit is **not published to npm yet**. Use the repository itself for now.
Node.js 22+ is required. This walkthrough intentionally separates the
consumer project from the Kit source.

## From a clean directory

Clone the Kit repository and make an npm tarball:

```bash
git clone https://github.com/uwavecom/AI-native-Development-Kit.git
cd AI-native-Development-Kit
npm pack --ignore-scripts
```

In a different directory, initialize a sample application and install the
created `.tgz` file (replace the example path with the actual file location):

```bash
mkdir first-kit-app
cd first-kit-app
npm init -y
npm pkg set type=module
npm install ../AI-native-Development-Kit/ai-native-development-kit-0.3.0.tgz
```

Copy `examples/consumer-first-action.mjs` from the cloned repository into
the consumer directory as `first-action.mjs` and run:

```bash
node first-action.mjs
```

Expected output:

```text
PASS: unapproved action blocked; approved action verified.
```

This runs against a **simulated provider** and demonstrates two distinct
outcomes: an unapproved destructive action does not execute, and a properly
approved action succeeds with provider-result verification.

## Verify the install path in CI

From the Kit repository:

```bash
node scripts/verify-consumer.mjs
```

This packs the Kit, installs it into a fresh temporary Node.js project,
executes the standalone consumer example, and removes the temporary project.

## Important production limits

The bundled signed approval authority uses in-memory replay state and is
only suitable for single-process demonstrations. The example issues its own
approval explicitly for teaching purposes. **Never** allow a model, an
untrusted client, or the executing agent to issue its own approval. A real
system needs a trusted human/application boundary, durable one-shot
approval state, audited identity, independent provider verification,
and appropriate policy, permissions, and concurrency controls.

This example does not claim to be a production-safe deletion service.

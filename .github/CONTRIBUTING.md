# Contributing

Thanks for your interest in contributing to `@deepgram/react`!

## Prerequisites

- [Bun](https://bun.sh/) 1.3+
- Optional: a [`deepgram/agent`](https://github.com/deepgram/agent) sibling checkout (`../agent`) for coordinated local development

## Setup

```bash
# Optional: clone and build the sibling agent SDK used by the local TypeScript path mapping
git clone git@github.com:deepgram/agent.git ../agent
cd ../agent && bun install && bun run build
cd -

# Clone and install this repo
git clone git@github.com:deepgram/react.git
cd react
bun install
```

The project intentionally uses TypeScript 5.9.3 until `vite-plugin-dts` bundles
an API Extractor release that supports TypeScript 6.x.

## Development

```bash
bun run dev         # Watch-build @deepgram/react
```

## Building

```bash
bun run build       # Build @deepgram/react
```

## Type-checking

```bash
bun run typecheck   # tsc --noEmit
```

## Testing

```bash
bun run test        # Run all tests
```

## Making Changes

1. Create a feature branch from `main`
2. Make your changes
3. Ensure the build is clean: `bun run build`
4. Ensure tests pass: `bun run test`
5. Commit using [conventional commits](https://www.conventionalcommits.org/) format
6. Open a pull request

## Commit Messages

This project uses conventional commits:

```
feat(hooks): add useAgentVolume hook
fix(provider): resolve reconnection race condition
docs: update hook API documentation
```

## Questions?

Open an issue or reach out in the [Deepgram Discord](https://discord.gg/deepgram).

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

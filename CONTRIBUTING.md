# Contributing to P2P File Share

Thank you for your interest in contributing to P2P File Share! This project is built on the principles of privacy, security, and decentralized data transfer.

## Development Workflow

### Dependency Management
This project uses **pnpm 11** with a strict security model for build scripts.

If you add a dependency that requires a build script (e.g., native modules like `sharp`, `sqlite3`, or build tools like `esbuild`), you must explicitly add it to the `pnpm.onlyBuiltDependencies` list in the root `package.json`.

```json
"pnpm": {
  "onlyBuiltDependencies": [
    "esbuild",
    "your-new-dependency"
  ]
}
```

Failure to do so will cause the CI build to fail.

### CI/CD Pipeline
Every pull request is automatically vetted for:
- Linting and Type-checking
- Unit Tests (Vitest & Jest)
- Docker Image Build verification
- End-to-End Tests (Playwright)

## How Can I Contribute?

### Reporting Bugs
- Search existing issues to see if the bug has already been reported.
- If not, create a new issue with a clear title and description.
- Include steps to reproduce, expected behavior, and actual behavior.
- Attach screenshots or recordings if applicable.

### Suggesting Enhancements
- Check if the enhancement has already been suggested.
- Open a new issue with the "enhancement" label.
- Explain why the feature would be useful and how it should work.

### Pull Requests
- Fork the repository and create your branch from `main`.
- Ensure your code follows the existing style and is well-documented.
- Write tests for new features or bug fixes.
- Provide a clear description of the changes in your PR.
- Reference any related issues.

## Technical Guidelines

- **Privacy First**: Never introduce telemetry or tracking that compromises user privacy.
- **Security**: All P2P communication must remain end-to-end encrypted.
- **Performance**: Keep the frontend lightweight and ensure efficient WebRTC signaling.

## License

By contributing, you agree that your contributions will be licensed under the project's [LICENSE](LICENSE).

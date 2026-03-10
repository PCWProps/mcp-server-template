## Summary

<!-- Provide a concise description of the changes in this PR. -->

## Related Issue

<!-- Link the issue this PR resolves. Remove if not applicable. -->

Fixes #

## Type of Change

<!-- Mark the relevant option with an [x]. -->

- [ ] 🐛 Bug fix (non-breaking change that fixes an issue)
- [ ] 🚀 New feature (non-breaking change that adds functionality)
- [ ] 🔧 New MCP tool
- [ ] 📚 Documentation update
- [ ] 🏗️ Refactor (no functional changes)
- [ ] ⚡ Performance improvement
- [ ] 🔒 Security fix
- [ ] 💥 Breaking change (fix or feature that changes existing behavior)
- [ ] 🤖 Dependency update

## Description of Changes

<!-- Describe your changes in detail. Why was this change needed? What approach did you take? -->

## Manual Testing Steps

<!-- Describe the steps you followed to manually verify your changes. -->

1. Clone this branch: `git checkout <branch-name>`
2. Install dependencies: `pnpm install`
3. Start dev server: `wrangler dev`
4. ...

## Checklist

<!-- Please confirm all items before requesting review. -->

### Code Quality

- [ ] My code follows the project's style guide (`pnpm lint` passes with no errors)
- [ ] TypeScript compiles cleanly (`pnpm typecheck` passes with no errors)
- [ ] I have formatted my code (`pnpm format`)
- [ ] I have added/updated JSDoc comments for new public APIs

### Testing

- [ ] I have added unit tests covering my changes
- [ ] All existing tests pass (`pnpm test` green)
- [ ] I have tested edge cases and error paths
- [ ] I have performed manual end-to-end testing (see steps above)

### Documentation

- [ ] I have updated `README.md` if relevant
- [ ] I have updated or added inline code documentation
- [ ] I have added a changeset (`pnpm changeset`) for user-facing changes

### Security

- [ ] My changes do not introduce any secrets or credentials into the codebase
- [ ] I have reviewed my changes for potential security vulnerabilities
- [ ] New environment variables are documented in `src/types/env.d.ts` and `wrangler.toml`

## Screenshots / Recordings

<!-- For UI changes or observable behavior changes, include screenshots or terminal recordings. -->

## Additional Notes

<!-- Anything else reviewers should know? Breaking changes? Migration steps? -->

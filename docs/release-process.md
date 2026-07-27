# Release Process

This project keeps release instructions in the repository so they are available across machines and environments.

## Recommended Flow

1. Commit feature or fix changes separately from release metadata.
2. Update `CHANGELOG.md` with the new version notes.
3. Bump the package version in `package.json`.
4. Create and push the release tag.
5. Create or edit the GitHub Release using the corresponding `CHANGELOG.md` entry as the release body.
6. Verify the published release body with `gh release view <tag> --json body`.

## Notes

- Keep the release notes body aligned with the changelog entry.
- Avoid ad-hoc text extraction when building release notes, since it can duplicate headings or drop formatting.
- If the release process changes, update this document in the same pull request.

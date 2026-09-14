# Contributing Guide

Thank you for your interest in contributing to **AI Native Website OS**! Whether you are filing an Issue, fixing a bug, improving documentation, or proposing a new feature, your participation is welcome.

> This guide applies to all contributors of the GitHub repository. Please read it before submitting.

---

## Table of Contents

- [Contribution Types](#contribution-types)
- [Getting Started](#getting-started)
- [Development Environment](#development-environment)
- [Submitting an Issue](#submitting-an-issue)
- [Submitting a Pull Request (PR)](#submitting-a-pull-request-pr)
- [Code Standards](#code-standards)
- [Commit Message Convention](#commit-message-convention)
- [Versioning and Changelog](#versioning-and-changelog)
- [Contribution License](#contribution-license)
- [Reporting Security Vulnerabilities](#reporting-security-vulnerabilities)
- [Code of Conduct](#code-of-conduct)

---

## Contribution Types

We welcome the following kinds of contributions — code is only one of them:

- **Code**: new features, bug fixes, performance improvements
- **Documentation**: improving and correcting docs, adding examples
- **Translation**: multilingual documentation and UI translation
- **Themes**: site theme design and implementation
- **Plugins**: feature extensions and ecosystem components
- **Templates**: page and site templates
- **Tutorials**: usage tutorials, best practices, case studies
- **Community activities**: answering questions, organizing discussions, spreading the word

---

## Getting Started

1. Click **Fork** at the top right of the repository to copy it to your account;
2. Clone your fork to your local machine:

   ```bash
   git clone https://github.com/<your-username>/website-os.git
   cd website-os
   ```

3. Add the upstream repository and keep it in sync:

   ```bash
   git remote add upstream https://github.com/website-os/website-os.git
   git fetch upstream
   ```

4. Create a feature branch based on the latest upstream main branch:

   ```bash
   git checkout -b feature/your-feature-name upstream/main
   ```

---

## Development Environment

> The following are general recommendations. Refer to the repository's `README` and documentation for actual environment requirements.

- Make sure the required runtimes and dependencies are installed (see the Getting Started section of the `README`);
- Start the local development service and complete a full "install → start → visit" cycle before making changes;
- Before submitting, ensure the project's own tests pass and that code quality checks (e.g. SonarQube / ESLint / unit tests) report no new blocking issues.

---

## Submitting an Issue

Before submitting an Issue, please:

1. **Search for existing Issues** to avoid duplicates;
2. Use the **Issue templates** provided by the repository (Bug Report / Feature Request);
3. Provide as much detail as possible:
   - **Bug**: environment (OS, browser, version), reproduction steps, expected result, actual result, logs and screenshots;
   - **Feature request**: background and pain points, requirement description, expected acceptance criteria.

---

## Submitting a Pull Request (PR)

When submitting a PR, please:

1. Use the **PR template** provided by the repository;
2. Keep each PR focused on **one** problem so it stays reviewable;
3. **Explain the problem and the change**: describe in the PR what problem is being solved, what changed, and how;
4. Link the related Issue: include `Closes #<issue number>` in the PR description;
5. Test your changes before submitting, include tests where applicable for code changes, and describe the testing performed in the PR;
6. Wait for maintainer review. If changes are requested, continue committing on the same branch and keep it up to date;
7. Before merging, make sure:
   - The branch is in sync with `main`;
   - CI checks pass;
   - Commit messages follow the commit message convention;
   - For behavioral changes, the related documentation and `CHANGELOG.md` have been updated;
   - You confirm that the contributed code can be distributed under the project's applicable license (see [Contribution License](#contribution-license)).

---

## Code Standards

- Follow the project's existing code style and directory structure;
- New code should include necessary comments and tests;
- Do not introduce unverified third-party dependencies;
- Never commit sensitive information (keys, tokens, internal addresses, customer data);
- If the project has code quality scanning configured (e.g. SonarQube), make sure there are no blocking issues before submitting.

---

## Commit Message Convention

We recommend following the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

[body]

[footer]
```

Common types:

| Type | Description |
| --- | --- |
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting changes that do not affect code meaning |
| `refactor` | Refactoring (neither a new feature nor a bug fix) |
| `perf` | Performance improvement |
| `test` | Test-related changes |
| `chore` | Build / toolchain / miscellaneous |

Example:

```
fix(auth): fix SMS verification code login failing on older browsers

Closes #123
```

---

## Versioning and Changelog

- Version numbers follow **SemVer** (`MAJOR.MINOR.PATCH`);
- When a PR with user-visible changes is merged, add an entry to the corresponding section of `CHANGELOG.md`;
- Releases are performed by maintainers following the established Release process.

---

## Contribution License

Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in this project shall be licensed under the **Apache License 2.0** terms applicable to the project, subject to any separate written agreement.

---

## Reporting Security Vulnerabilities

**Do not disclose security vulnerabilities through public Issues.** If you discover a security vulnerability, please follow the responsible reporting process described in [SECURITY.md](SECURITY.md).

---

## Code of Conduct

Please read and follow the repository's [CODE_OF_CONDUCT](CODE_OF_CONDUCT.md). Any disrespectful, harassing, or aggressive behavior will be taken seriously.

---

Thank you again for your contribution!

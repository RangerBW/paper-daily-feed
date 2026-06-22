# Agent deployment instructions

[English](./agent-deployment.md) | [简体中文](./agent-deployment.zh-CN.md)

> This file is an instruction layer for AI coding agents. It supplements the user-facing setup guide instead of repeating it.

## Source of truth

- Read and follow `@README.md`, especially **Get started**, from beginning to end. It defines the required settings, optional features, and workflows.
- Consult `@config/app.example.jsonc` only when the user needs configuration beyond the minimal example in `@README.md`.
- Deploy only the canonical repository: <https://github.com/nehSgnaiL/paper-daily-feed>.
- If this file and `@README.md` differ, stop and follow `@README.md`.

## How to work with the user

- Complete every step you can with the GitHub capabilities already available. Prefer `gh` when it is installed; do not require a local clone unless your tools need one.
- Ask one question at a time, use plain language, and explain where to find unfamiliar values. Ask about optional features before requesting their settings.
- Explain only actions that the user must perform manually, such as GitHub authorization or secure credential entry. Resume automation after each manual step.
- Confirm the authenticated GitHub account and target fork before making changes. Reuse a valid existing fork when possible. Never modify the canonical repository, push commits, or change project files during deployment.

## Protect credentials

- Never ask the user to paste a password, token, authorization code, or API key into chat.
- Never expose credentials in command arguments, output, logs, temporary files, configuration variables, or shell history.
- Use a secure secret-input capability or direct the user to the target fork's GitHub Actions Secrets form. Wait for confirmation without reading the entered value.
- Keep `APP_CONFIG` free of credentials. Show the proposed non-secret configuration and obtain confirmation before replacing an existing value.

## Finish the deployment

- Carry out every setup and workflow-enablement step in `@README.md`; do not merely describe them.
- Run the documented test workflow and wait for it to finish. If it fails, inspect non-secret logs, correct deployment configuration, and rerun it.
- Do not weaken security or edit application/workflow code to force a successful test.
- Finish only after the test workflow succeeds. Report the fork URL, successful run URL, daily-delivery status, and the simple way to pause delivery. Never repeat credentials.

# 1. Share logic, write views twice

Date: 19 Nov 2026. Status: accepted.

## Context

Moni has a mature Expo phone app and is getting a full web app. Components that look alike behave differently on a desktop: a segmented control glides on the phone and clicks on the web, a hold menu becomes a right-click, sheets become popovers, and rows gain hover, checkboxes and J/K. The domain rules (what counts as spending, money formatting, the budget month, chart maths) must agree on both.

## Decision

Domain rules, formatting, chart maths, tokens, the mascot and the data layer live in workspace packages (`packages/*`) as source TypeScript. React views are written once in React Native (`apps/mobile`) and once for the DOM (`apps/web`). Shared packages compile against a tsconfig with no DOM library (`packages/typescript-config/shared.json`) and a lint that bans platform imports (`@repo/eslint-config/shared`).

## Consequences

A rule changes in one place and both apps agree. Each screen is built twice, which is the cost of desktop behaviour that feels native. A shared component library was rejected because it fails the deletion test: deleting it would not remove work from either app.

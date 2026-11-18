# 2. One Next.js app draws both web layouts

Date: 19 Nov 2026. Status: accepted.

## Context

The web app has a desktop layout (sidebar or rail) and a phone layout under 700 px wide or 500 px tall, which is the mobile v2 design. Crossing the breakpoint must keep the route, the selected row and any half-typed field.

## Decision

The phone layout is DOM views modelled on the mobile v2 screens, inside the same Next.js app. The layout follows the viewport, and the state that must survive a switch lives in the URL and the store.

## Consequences

Resizing a window never reloads or loses input. React Native Web and an Expo web build were rejected: either would be a second app, so crossing the breakpoint would lose state, and both would ship the phone's interaction model to desktop users.

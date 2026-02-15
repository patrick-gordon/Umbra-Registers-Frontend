# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Backend Checklist (FiveM Integration)

- Send `openRegister` with `role`, `view`, `storeId`, `registerId`, and `interaction`.
- Include org membership in `openRegister` (preferred): `isOrganizationMember: true|false`.
- If your server already uses different keys, frontend also accepts:
  - booleans: `isOrgMember`, `organizationMember`, `isBusinessMember`
  - org identifiers: `organizationId`, `orgId`, `businessId`, `organization.id`
  - same keys inside `interaction` or `interactionContext`
- Send `setRole` updates when role changes; include membership when available.
- Send `syncState` updates for state rehydration; include membership when available.
- Optional for persistent analytics: include `registerStatsByRegister` (or `statsByRegister`) in `syncState`.
- Optional minigame hooks: handle `stealMinigameStarted` and `stealMinigameResolved` callbacks.
- Membership rule enforced by frontend:
  - members can access `employee`/`manager` based on role
  - non-members are restricted to `customer` view
- Keep payload/action naming aligned with `FIVEM_INTEGRATION.md`.

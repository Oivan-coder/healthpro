# Frontend regression checks

Run with Node.js 22.22.2+ or 24.15+:

```sh
npm ci --prefix tests/frontend
npm test --prefix tests/frontend
node --test tests/backend/lab-reference.test.cjs
```

The dependencies are development tools in this directory only. They are not shipped
in the frontend or installed by the backend Docker build.

- `smoke.cjs`: real frontend auth client and app controller with simulated API responses;
  login, errors, password change gate, logout, `user`/`tester`/`admin` routes, navigation,
  drawer and modal focus.
- `responsive.cjs`: CSS parsing and cascade checks at 320–1920 px, including form display,
  hidden role links and mobile navigation; independent workspace/detail container widths
  cover report stacking, unbroken dates and headers alongside the fixed sidebar.
- `pages.cjs`: actual page renderers with synthetic fixtures, laboratory modes and chart
  resizing, device pixel ratio, fonts and observer cleanup.
- `tester-profile.cjs`: editable profile and tester-only manual result entry, including
  bounded autocomplete, selection focus, reopening and keyboard selection, patient
  binding and the unchanged report API payload. Profile age uses a fixed clock.
- `../backend/lab-reference.test.cjs`: production services with in-memory repositories;
  saved references agree across dashboard, reports, history and trends, historical
  choices survive profile changes, missing/text values stay unassessed, and MySQL
  read mapping retains report IDs and nullable bounds.

No requests are sent to Timeweb or MySQL. These checks use jsdom, which does not lay
out or paint pages. They do not replace visual testing in Chrome/Safari, mobile keyboard
checks or sign-in against the deployed server and its session cookies.

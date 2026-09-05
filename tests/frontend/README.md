# Frontend regression checks

Run with Node.js 22.22.2+ or 24.15+:

```sh
npm ci --prefix tests/frontend
npm test --prefix tests/frontend
```

The dependencies are development tools in this directory only. They are not shipped
in the frontend or installed by the backend Docker build.

- `smoke.cjs`: real frontend auth client and app controller with simulated API responses;
  login, errors, password change gate, logout, `user`/`tester`/`admin` routes, navigation,
  drawer and modal focus.
- `responsive.cjs`: CSS parsing and cascade checks at 320–1920 px, including form display,
  hidden role links, mobile navigation, history cards and table scrolling.
- `pages.cjs`: actual page renderers with synthetic fixtures, laboratory modes and chart
  resizing, device pixel ratio, fonts and observer cleanup.
- `tester-profile.cjs`: editable profile and tester-only manual result entry, including
  bounded autocomplete, patient binding and the unchanged report API payload.

No requests are sent to Timeweb or MySQL. These checks use jsdom, which does not lay
out or paint pages. They do not replace visual testing in Chrome/Safari, mobile keyboard
checks or sign-in against the deployed server and its session cookies.

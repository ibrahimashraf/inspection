# Tests

`suit.js` — no. **`suite.js`** is the regression suite. It has no dependencies and
runs from `file://`, matching the app's no-build rule.

## Running it

In the browser, either paste the file into the console or add a script tag:

```html
<script src="tests/suite.js"></script>
```

then:

```js
await __imsTest()
```

Results print as a table and are parked on `window.__imsLastResults`.

## Running it headlessly (dev only)

`run-suite.js` drives a real browser so the suite can gate a change. It is the
only thing here that needs Node, and the app does not depend on it:

```
npm i playwright-core
CHROME_PATH="C:\Program Files\Google\Chrome Beta\Application\chrome.exe" node tests/run-suite.js
```

Exit code is non-zero if any test fails.

## mutation-check.ps1

Reintroduces each defect that was fixed and confirms the matching test fails.
A test that cannot fail proves nothing, so run this after touching the suite:

```
powershell -File tests/mutation-check.ps1
```

It rewrites `index.html` in place and restores the original when it finishes —
commit or stash first so a crash cannot leave a mutated file behind.

## What the suite covers

Every test corresponds to a real defect found in the October audit, not to a
hypothetical: the `AIO.init()` deadlock that stopped `bootApp` on a cold
profile, the transposed QR format-information bits, the version-10 ceiling, the
`lblSpan` XSS, the blank Ctrl+P, the peek handle vanishing, the zoom bar hidden
behind the app bar, peek scrolling the page behind it, `applyLayout` wiping the
peek state, the three copies of the blob-field list, the `state.js` store layer
that nothing called, and `@idb:` markers reaching an `img src`.

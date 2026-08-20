# Architecture

Origin Desktop is the desktop Git client for Cursor Origin. Electron owns processes. The renderer owns screens.

## Direction

```text
electron/main.cjs
  -> store.cjs
  -> git.cjs
      -> spawn.cjs
      -> parse.cjs
  -> origin.cjs
      -> spawn.cjs
      -> parse.cjs
      -> git.cjs          # clone fallback only
      -> profile.cjs      # Gravatar / GitHub avatar for the signed-in account
  -> menu.cjs

src/main.jsx
  -> App.jsx
      -> chrome.jsx
      -> workspace.jsx
          -> syntax.js
      -> dialogs.jsx
      -> display.js
      -> icons.jsx
```

`src/display.js` formats git and Origin facts for the UI. It does not spawn processes or import React.

`src/syntax.js` tokenizes diffs. It does not import React.

`electron/parse.cjs` is the only parser of git porcelain, remotes, logs, and Origin CLI text.

`electron/profile.cjs` is the only network path for account avatars.

## Rules

- One production path per operation. Git lives in `git.cjs`. Origin CLI lives in `origin.cjs`.
- No `utils`, `helpers`, `common`, `shared`, or `manager` files.
- Electron does not import the renderer.
- The renderer talks to the main process only through `window.od`.
- Public npm scripts are `dev`, `build`, `start`, `pack`.
- Unfinished work is not marked `TODO` in source.

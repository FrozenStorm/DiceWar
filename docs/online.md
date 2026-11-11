# Online lobby

Players enter a name and land in one shared lobby. They can challenge a free
player (own dice set, landscape, who starts, rules on/off); the challenged
player picks their dice set and accepts or declines. On accept the game starts
for both. The challenger is Player 1 (bottom), the challenged player Player 2.

- Code: `net/online.js` (lobby, challenges, game sync), `net/backend-firebase.js`
  (Firebase Realtime Database + anonymous sign-in), `net/firebase-config.js`.
- After every action the full game snapshot is written to `games/{id}/state`
  with a sequence number; the opponent's browser applies it.
- Reload: the running game id is kept in localStorage, the page goes straight
  back into the game.
- Opponent disconnected: countdown of 3 minutes, then "Claim Win".
- Finished games are deleted by the last player who leaves; games older than
  24 h are deleted by their players when they next enter the lobby.

## Database rules

`database.rules.json` must be published in the Firebase console:
Realtime Database → Rules → paste the file → Publish.

## Tests

`npm run test:online` plays two browsers against an in-process mock of the
database that follows the same rules (`index.html?backend=mock`). Needs
Playwright (`npm i -D playwright`).

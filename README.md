# MOFO: Mind Over FOMO (Chrome extension)

This repository is the exact code of the MOFO extension as it is published on the
[Chrome Web Store](https://chromewebstore.google.com/detail/mind-over-fomo-mofo-your/ahljpbjjmfkdepihfgnpfkkehhbimdag).
It's public so anyone can read it and check that the version in their browser is this code.

MOFO is a chart copilot for [fomo.family](https://fomo.family): entry heat, a Gaussian channel, your plan on the
chart, holder checks, a trade journal. **It can't place trades, sign anything or touch your wallet.**

## Check it yourself (1 minute)

```
git clone https://github.com/mindoverfomotools-blip/mofo-extension
cd mofo-extension
python3 verify.py
```

`verify.py` downloads MOFO straight from Google's Chrome Web Store servers and compares every file with the
`extension/` folder here. You should see:

```
MATCH: the Chrome Web Store version 0.9.2 is exactly the code in this repo.
```

It uses only the Python standard library. The only difference it allows is the one line the store itself adds to
`manifest.json` (`update_url`) and Google's signature folder (`_metadata/`). Every released version from 0.9.2 on is
tagged (`git checkout v0.9.2`), so you can also see exactly what changed between versions.

## What MOFO can access

What Chrome shows you when you install it, from [`extension/manifest.json`](extension/manifest.json):

| Permission | What it means |
|---|---|
| Runs on `https://fomo.family/*` only | MOFO can't see any other website, other tabs, or other extensions (MetaMask, Phantom, any wallet). |
| `storage`, `unlimitedStorage` | Saves your settings, rules and trade journal inside the extension, on your computer. |

No `<all_urls>`, no host permissions, no tabs, cookies, clipboard, downloads or scripting permissions.
Chrome Web Store rules (Manifest V3) ban code loaded after review, so everything that runs is in this repo.

## What it doesn't do

- It never clicks, types or submits anything on fomo.family. It only reads the page and draws on top of it.
- It has no wallet code: no wallet connection, no signing, no private keys or seed phrases.
- It never sends your fomo.family session to MOFO's servers (see "fomo.family login" below).

## Every server it talks to

| Server | Why | What it gets |
|---|---|---|
| `mindoverfomo.tools/ext-config.json` | A small settings file with the addresses below | Nothing (a plain download) |
| `mofo-proxy.mofo-proxy.workers.dev` (the MOFO service) | Free AI narrative, Ask MOFO, holder data | The token or wallet address asked about; for Ask MOFO, your question with the chart snapshot, your open position and today's P&L; a random install id for daily limits |
| `api.mindoverfomo.tools/game` | THE CALL (buy or wait calls) | A random account id, your calls, and the name and fomo username if you set them |
| `api.geckoterminal.com` | Public price history to grade your closed trades | The token address |
| `prod-api.fomo.family` | Trader stats on fomo profiles | Your logged-in fomo.family session (see below) |

Links to block explorers and X only open when you click them.

### fomo.family login

fomo.family traders' trades don't show up on-chain, so the trader card on a profile reads the trader's swap
history from fomo.family's own API, the same request the fomo.family page makes. To do that MOFO reuses the login
headers the page itself sends (`src/net.js`, `NET.api`). They stay in the open tab's memory, are only ever sent back
to `prod-api.fomo.family`, and are never stored or sent anywhere else.

### Dormant code

`src/ai-core.js` also contains a bring-your-own-keys mode that calls `api.anthropic.com` and `api.twitterapi.io`
with keys a user types in. It's switched off in the store version (`OWN_KEYS = false` in `src/background.js`) and
its settings are removed, so it never runs.

## Where things are

| File | What it does |
|---|---|
| `src/net.js` | Reads the JSON the fomo.family page already loads (token data, your positions); the fomo API helper |
| `src/main.js` | Runs on token pages: analysis, panel, badges, chart drawings, THE CALL card, trader cards |
| `src/tv.js` | Draws on fomo's TradingView chart and recolors candles |
| `src/engine.js`, `src/score-model.js`, `src/holders.js` | Chart math, the 0 to 100 vote, holder checks |
| `src/background.js` | Talks to the servers above |
| `src/bridge.js` | Passes messages between the page and the extension; only an allowlist of message types |
| `src/fomo-trades.js`, `src/grade.js`, `src/prices.js` | Trader stats, trade journal grading, price history |
| `*.html`, `*.js` at the top | Settings, journal, caller board, demo pages |

## Security and bug bounty

See [SECURITY.md](SECURITY.md). Up to **$1,000** for a way MOFO could move funds, sign, leak a login or run code
it didn't ship.

## License

Source-available, not open source. You can read, run and verify this code; you can't copy or reuse it. See [LICENSE](LICENSE).

Site: https://mindoverfomo.tools · Safety page: https://mindoverfomo.tools/safety.html · Contact: mindoverfomotools@gmail.com

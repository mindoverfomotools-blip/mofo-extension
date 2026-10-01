# MOFO: Mind Over FOMO

A Chrome extension for fomo.family. It draws on the chart you already trade on and checks every buy against your own rules before you click. It can't place trades, sign anything or touch your wallet.

Site: https://mindoverfomo.tools · X: https://x.com/mindoverfomo · Telegram: https://t.me/mindoverfomo

## Install

1. Unzip this folder somewhere it can stay.
2. Open `chrome://extensions`, turn on **Developer mode** (top right), click **Load unpacked** and pick the unzipped folder.
3. Open any token on fomo.family. MOFO shows up on the chart.

## What it does

- **On the chart:** a Gaussian channel (4 poles, 144 bars, bands at ×1.414), the fomo line where the entry turns hot, a buy zone with its stop and two targets, support and resistance zones with their touch counts, breakout and exhaustion arrows. Everything drawn is locked and never saved into your chart layout. Candles in black and white, green and red, or FOMO's own colors (⚙ in the panel).
- **Entry check:** calm, warm, hot or extreme, with a bell curve showing where price sits in its channel.
- **Your position:** stop moved to entry once you're up 25%, sell half at +50%, a trailing stop after +100%.
- **Who holds it:** the top holders with win rate, P&L and hold time, and flags for bundlers, snipers, insiders and wallets funded by the same wallet.
- **Vote, 0 to 100:** how a token's holder mix ranks against thousands of logged tokens on the same chain, on the token page and in every token list. It was fitted on what those tokens did over the next 24 hours and checked on later days: on Solana, tokens voting 70+ reached +50% before -50% about 38% of the time, against 26% for all tokens. Solana, BNB and Base for now.
- **Token risk, flow, a one-click narrative rundown and a chat** that sees the chart, the holders and your rules.
- **On fomo itself:** badges next to the token name and warnings above the buy button when you're chasing, oversized or averaging down.
- **Trade journal:** closed trades graded against your rules.
- **THE CALL:** when a token turns hot, make the call: buy or wait. Nothing gets traded. It settles 15 minutes later with the real price, and the caller board shows who calls well, with a link to their fomo profile.

## Free AI

The rundown, the chat and the holder profiles run on the MOFO service at no cost, with a daily limit per install. If you'd rather use your own AI keys (or you hit the limit), add them in the extension's settings: MOFO then calls Claude and twitterapi.io directly.

## Privacy

Chart analysis, risk checks and your rules run in your browser. The MOFO service receives only what a feature needs: the token you ask about, your chat question with the chart snapshot, and a random install id used for the daily limits. MOFO never sees your wallet or your fomo.family login. Full policy: https://mindoverfomo.tools/privacy.html

Analysis, not advice. MOFO never trades.

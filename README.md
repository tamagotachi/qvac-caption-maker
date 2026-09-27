# Social Caption Maker (QVAC)

Describe your photo or post, pick the platform (Instagram, X, LinkedIn, TikTok or Facebook), a vibe and whether you want emojis, and an **on-device AI** writes several captions plus a set of **hashtags**. Tap hashtags to add or remove them, see a **character counter** for your platform on every caption, and copy the caption with your hashtags in one tap.

It runs **on your own computer** using [QVAC](https://github.com/tetherto/qvac), Tether's open-source AI SDK.
No API key, no cloud service, and what you type never leaves your machine.

![screenshot](screenshot.png)

## SDK version

`@qvac/sdk` **0.19.0** (declared in `package.json`)

Functions used: `loadModel` and `completion` (with structured output via `responseFormat`), with the `LLAMA_3_2_1B_INST_Q4_0` model.

## Install

You need [Node.js](https://nodejs.org) 22 or newer and some free disk space for the model.

```bash
git clone https://github.com/misaki-codex/qvac-caption-maker.git
cd qvac-caption-maker
npm install
```

## Run

```bash
npm start
```

Then open **http://localhost:3092** (the address, not the HTML file). The first start downloads the model.
While it loads, simple template captions and hashtags from your own words are used instead.

## How it works

- `server.js` calls `completion` with a JSON schema (captions and hashtags). It removes hashtags the AI puts inside captions, cleans every hashtag (no spaces or symbols) and drops duplicates. The AI is told never to invent places or people.
- Character counting is plain code, and limits are typical values, so check each app's current rules.
- The server listens on `127.0.0.1`, so only your own computer can reach it.

## Troubleshooting

If you see `RPC_INIT_TIMEOUT`, the QVAC worker was slow to start. `server.js` already waits 3 minutes.
Set `QVAC_RPC_INIT_TIMEOUT_MS` (milliseconds) before `npm start` to wait longer, and make sure no other
QVAC app is running at the same time. If you see `ERR_MODULE_NOT_FOUND`, delete the `node_modules` folder
and run `npm install` again (this usually means an install was interrupted, for example by a full disk).

## License

MIT

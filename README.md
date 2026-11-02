# botfather-lib

Clean, generic BotFather client for Telegram bot creation. Drives the official
[@BotFather](https://t.me/botfather) over **any** MTProto client that exposes a
minimal message surface — no session storage, no keyring, no phone, no estate
wiring. The caller owns the authenticated client and the resulting token.

Companion to the estate's private TaaS operator (arroyo); this package is the
shareable capability layer, per the serum public/private split: **public =
the thin contract, private = the operational wiring.**

## Install

```sh
bun add @toxicwind/botfather-lib
```

## Usage

```ts
import { createBot } from "@toxicwind/botfather-lib";
// (GramJS or any compatible client with sendMessage + getMessages)
await createBot(client, { name: "My New Bot", username: "my_new_bot" });
// → { ok: true, token: "123456789:AAH…", botUsername: "my_new_bot_bot" }
```

### API

- `createBot(client, { name, username, promptDelayMs? })` — sends `/newbot`,
  answers name + username (auto-`_bot` suffix), parses the token from
  BotFather's official reply.
- `withBotSuffix(username)` — ensures Telegram's `*bot` requirement.
- `looksLikeBotToken(value)` — validates the `digits:chars` token shape.
- `OFFICIAL_BOTFATHER_ID` / `BOTFATHER_USERNAME` — the sanctioned peer.

### Client interface

```ts
interface BotFatherClient {
  sendMessage(username: string, opts: { message: string }): Promise<unknown>;
  getMessages(username: string, opts: { limit: number }): Promise<
    Array<{ message?: string; senderId?: unknown }>
  >;
  delay?(ms: number): Promise<void>;
}
```

GramJS (`telegram` package) satisfies this shape directly.

## Security

Only the **official BotFather peer id** (`93372553`) may supply credentials.
Any other sender — squatter lookalikes, token-bait "migrate to our channel"
messages — is refused structurally before the token regex runs.

## Test

```sh
bun test   # 9 tests: flow, token parse, squatter guard, suffix, failures
```

MIT.
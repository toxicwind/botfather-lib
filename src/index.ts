/**
 * @botfather-lib — clean, generic BotFather client library.
 *
 * Drives Telegram's official @BotFather over any MTProto client that
 * exposes a minimal message surface (sendMessage + getMessages). No session
 * storage, no keyring, no phone, no estate wiring — the caller owns the
 * authenticated client.
 *
 * Security: only the OFFICIAL BotFather peer id may supply credentials.
 * Squatter lookalikes ("migrate to our channel", token-bait scams) are
 * refused structurally — the token regex never runs on untrusted text.
 */
export const OFFICIAL_BOTFATHER_ID = 93372553;
export const BOTFATHER_USERNAME = "botfather";

/** Minimal message surface a client must satisfy (GramJS-compatible shape). */
export interface BotFatherClient {
	sendMessage(username: string, opts: { message: string }): Promise<unknown>;
	getMessages(username: string, opts: { limit: number }): Promise<
		Array<{
			message?: string;
			senderId?: unknown;
		}>
	>;
	/** Optional: persist state / pause between steps. Default no-op. */
	delay?(ms: number): Promise<void>;
}

export interface NewBotRequest {
	/** Bot display name (sent as BotFather's first prompt answer). */
	name: string;
	/** Desired bot username; a trailing "_bot" is appended if missing. */
	username: string;
	/** ms between BotFather prompts (default 1500). */
	promptDelayMs?: number;
}

export interface NewBotResult {
	ok: boolean;
	token?: string;
	botUsername?: string;
	error?: string;
}

const TOKEN_RE = /\b(\d{8,12}:[A-Za-z0-9_-]{30,})\b/;

/** Normalize a bot username to Telegram's `*bot` requirement. */
export function withBotSuffix(username: string): string {
	return username.toLowerCase().endsWith("bot") ? username : `${username}_bot`;
}

/** True when the value matches Telegram's bot-token shape. */
export function looksLikeBotToken(value: string): boolean {
	return TOKEN_RE.test(value);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Drive @BotFather: /newbot → name → username → parse the token from the
 * official reply. The token is returned to the caller — who stores it
 * wherever they want.
 */
export async function createBot(
	client: BotFatherClient,
	req: NewBotRequest,
): Promise<NewBotResult> {
	const delay = client.delay ?? sleep;
	const stepMs = req.promptDelayMs ?? 1500;
	const username = withBotSuffix(req.username);

	try {
		await client.sendMessage(BOTFATHER_USERNAME, { message: "/newbot" });
		await delay(stepMs);

		await client.sendMessage(BOTFATHER_USERNAME, { message: req.name });
		await delay(stepMs);

		await client.sendMessage(BOTFATHER_USERNAME, { message: username });
		await delay(stepMs + 1000); // token reply takes longest

		const msgs = await client.getMessages(BOTFATHER_USERNAME, { limit: 1 });
		const reply = msgs[0]?.message ?? "";
		const senderId = msgs[0]?.senderId ? Number(msgs[0].senderId.toString()) : 0;

		if (senderId !== OFFICIAL_BOTFATHER_ID) {
			return {
				ok: false,
				error: `botfather reply sender id ${senderId} != official ${OFFICIAL_BOTFATHER_ID} — refusing (squatter/phishing guard)`,
			};
		}

		const match = reply.match(TOKEN_RE);
		if (!match) {
			return {
				ok: false,
				error: `botfather did not return a token: ${reply.slice(0, 200)}`,
			};
		}

		return { ok: true, token: match[1], botUsername: username };
	} catch (err) {
		return {
			ok: false,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}
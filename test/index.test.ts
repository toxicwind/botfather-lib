import { describe, expect, it } from "bun:test";
import {
	BOTFATHER_USERNAME,
	createBot,
	looksLikeBotToken,
	OFFICIAL_BOTFATHER_ID,
	withBotSuffix,
} from "../src/index.ts";
import type { BotFatherClient, NewBotRequest } from "../src/index.ts";

/** Scripted fake: returns queued replies per getMessages call. */
function fakeClient(replies: Array<{ message?: string; senderId?: unknown }>): BotFatherClient {
	let calls = 0;
	return {
		async sendMessage() {},
		async getMessages() {
			const r = replies[Math.min(calls, replies.length - 1)]!;
			calls += 1;
			return [r];
		},
		async delay() {}, // no real waiting in tests
	};
}

describe("withBotSuffix", () => {
	it("appends _bot when missing", () => {
		expect(withBotSuffix("my_estate_bot")).toBe("my_estate_bot");
		expect(withBotSuffix("estate_coyote")).toBe("estate_coyote_bot");
	});
	it("is case-insensitive on the suffix", () => {
		expect(withBotSuffix("MyBot")).toBe("MyBot");
	});
});

describe("looksLikeBotToken", () => {
	it("accepts digits:chars shape", () => {
		expect(looksLikeBotToken("123456789:AAHfake-token-abcdefghijklmnopqrstuvwxyz012345")).toBe(true);
	});
	it("rejects short / non-token values", () => {
		expect(looksLikeBotToken("not-a-token")).toBe(false);
		expect(looksLikeBotToken("123:short")).toBe(false);
	});
});

describe("createBot", () => {
	const okReply = {
		message:
			"Done! Congratulations on your new bot. You will find it at t.me/coyote_test_bot. " +
			"You can now add a description, about section and profile picture for your bot, " +
			"see /help for a list of commands. Use this token to access the HTTP API:\n" +
			"123456789:AAHfake-token-abcdefghijklmnopqrstuvwxyz012345\n" +
			"Keep your token secure and store it safely.",
		senderId: OFFICIAL_BOTFATHER_ID,
	};

	it("creates a bot and parses the official token", async () => {
		const res = await createBot(fakeClient([okReply]), { name: "Coyote Test", username: "coyote_test" });
		expect(res.ok).toBe(true);
		expect(res.token).toBe("123456789:AAHfake-token-abcdefghijklmnopqrstuvwxyz012345");
		expect(res.botUsername).toBe("coyote_test_bot");
	});

	it("refuses a squatter/impostor sender (anti-phishing guard)", async () => {
		const res = await createBot(fakeClient([{ message: okReply.message, senderId: 999999 }]), {
			name: "X",
			username: "x",
		});
		expect(res.ok).toBe(false);
		expect(res.error).toContain("squatter");
	});

	it("errors when the reply carries no token", async () => {
		const res = await createBot(fakeClient([{ message: "Something went wrong, try later", senderId: OFFICIAL_BOTFATHER_ID }]), {
			name: "X",
			username: "x",
		});
		expect(res.ok).toBe(false);
		expect(res.error).toContain("did not return a token");
	});

	it("surfaces client failures", async () => {
		const broken: BotFatherClient = {
			async sendMessage() {
				throw new Error("connection reset");
			},
			async getMessages() {
				return [];
			},
			async delay() {},
		};
		const res = await createBot(broken, { name: "X", username: "x" });
		expect(res.ok).toBe(false);
		expect(res.error).toContain("connection reset");
	});

	it("normalizes usernames through withBotSuffix", async () => {
		const req: NewBotRequest = { name: "At Exist", username: "atexist_bot" };
		expect(withBotSuffix(req.username)).toBe("atexist_bot");
		const msgs: string[] = [];
		const recording: BotFatherClient = {
			async sendMessage(_, { message }) {
				msgs.push(message);
			},
			async getMessages() {
				return [okReply];
			},
			async delay() {},
		};
		await createBot(recording, { name: "At Exist", username: "atexist" });
		expect(msgs).toEqual(["/newbot", "At Exist", "atexist_bot"]);
		expect(BOTFATHER_USERNAME).toBe("botfather");
	});
});
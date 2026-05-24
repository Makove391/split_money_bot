import { Bot, webhookCallback } from "grammy";

export function createBot(env: Env): Bot {
	const bot = new Bot(env.BOT_TOKEN, {
		botInfo: JSON.parse(env.BOT_INFO),
	});

	bot.command("start", (ctx) => ctx.reply("Welcome to Split Money Bot!"));
	bot.command("help", (ctx) =>
		ctx.reply("Available commands:\n/start — welcome message\n/help — this message"),
	);

	bot.on("message", (ctx) => ctx.reply("Unknown command. Use /help to see available commands."));

	return bot;
}

export function createWebhookHandler(env: Env) {
	const bot = createBot(env);
	return webhookCallback(bot, "cloudflare-mod", {
		secretToken: env.WEBHOOK_SECRET,
	});
}

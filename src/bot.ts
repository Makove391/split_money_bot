import { Bot, InlineKeyboard, webhookCallback } from "grammy";
import {
	getActiveSplit,
	getSplitById,
	countSplitsOnDate,
	createSplit,
	joinSplit,
	isParticipant,
	addExpense,
	getParticipants,
	getSplitExpenses,
	finalizeSplit,
	calculateSettlement,
} from "./db";

export function createBot(env: Env): Bot {
	const bot = new Bot(env.BOT_TOKEN, {
		botInfo: JSON.parse(env.BOT_INFO),
	});

	function splitKeyboard(splitId: number, joinCount: number): InlineKeyboard {
		return new InlineKeyboard()
			.text(joinCount > 0 ? `Join (${joinCount})` : "Join", `join:${splitId}`)
			.text("👥 Participants", `participants:${splitId}`)
			.text("✅ Finalize", `finalize:${splitId}`);
	}

	const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

	// /newsplit [title] — create a new split and post a Join button
	bot.command("newsplit", async (ctx) => {
		const groupId = String(ctx.chat.id);
		const existing = await getActiveSplit(env.DB, groupId);
		if (existing) return;

		const now = new Date();
		const dateStr = now.toISOString().slice(0, 10);
		const count = await countSplitsOnDate(env.DB, groupId, dateStr);
		const defaultTitle = `Split ${now.getUTCDate()} ${MONTHS[now.getUTCMonth()]} #${count + 1}`;

		const title = ctx.match.trim() || defaultTitle;
		const splitId = await createSplit(env.DB, groupId, title);

		await ctx.reply(
			`*${title}* started!\nTap Join to participate, then use /add to log your expenses.`,
			{ parse_mode: "Markdown", reply_markup: splitKeyboard(splitId, 0) },
		);
	});

	// Inline button: join:<splitId>
	bot.callbackQuery(/^join:(\d+)$/, async (ctx) => {
		const splitId = parseInt(ctx.match[1], 10);
		const user = ctx.from;
		const username = user.username ? `@${user.username}` : user.first_name;

		const result = await joinSplit(env.DB, splitId, user.id, username);

		if (result.meta.changes === 0) {
			await ctx.answerCallbackQuery({ text: "You've already joined this split.", show_alert: true });
		} else {
			const participants = await getParticipants(env.DB, splitId);
			await ctx.editMessageReplyMarkup({
				reply_markup: splitKeyboard(splitId, participants.length),
			});
			await ctx.answerCallbackQuery({
				text: `You joined the split! Participants: ${participants.map((p) => p.username).join(", ")}`,
				show_alert: true,
			});
		}
	});

	// Inline button: participants:<splitId>
	bot.callbackQuery(/^participants:(\d+)$/, async (ctx) => {
		const splitId = parseInt(ctx.match[1], 10);
		const participants = await getParticipants(env.DB, splitId);
		const text =
			participants.length === 0
				? "No participants yet."
				: `Participants (${participants.length}):\n${participants.map((p) => p.username).join(", ")}`;
		await ctx.answerCallbackQuery({ text, show_alert: true });
	});

	// Inline button: finalize:<splitId>
	bot.callbackQuery(/^finalize:(\d+)$/, async (ctx) => {
		const splitId = parseInt(ctx.match[1], 10);

		const [split, participants, expenses] = await Promise.all([
			getSplitById(env.DB, splitId),
			getParticipants(env.DB, splitId),
			getSplitExpenses(env.DB, splitId),
		]);

		if (participants.length === 0) {
			await ctx.answerCallbackQuery({ text: "Can't finalize — nobody has joined yet.", show_alert: true });
			return;
		}

		await finalizeSplit(env.DB, splitId);
		await ctx.answerCallbackQuery();

		const title = split?.title ?? "Split";
		const total = expenses.reduce((s, e) => s + e.amount, 0);
		const share = fmt(total / participants.length);
		const settlements = calculateSettlement(expenses, participants);

		const expenseLines =
			expenses.length === 0
				? ["Nobody added any expenses."]
				: expenses.map(
						(e) => `• ${e.username}: ${fmt(e.amount)}${e.description ? ` (${e.description})` : ""}`,
					);

		const settlementLines =
			settlements.length === 0
				? ["Everyone is even!"]
				: settlements.map((s) => `• ${s.from} → ${s.to}: ${fmt(s.amount)}`);

		const settlementText = [
			`*${title} — Final*`,
			`Participants: ${participants.map((p) => p.username).join(", ")}`,
			``,
			`*Expenses:*`,
			...expenseLines,
			`Total: ${fmt(total)} | Each owes: ${share}`,
			``,
			`*Who pays whom:*`,
			...settlementLines,
		].join("\n");

		await ctx.editMessageText(
			`*${title}* ✅ Finalized\nParticipants: ${participants.map((p) => p.username).join(", ")}`,
			{ parse_mode: "Markdown" },
		);
		await ctx.reply(settlementText, { parse_mode: "Markdown" });
	});

	// /add <amount> [description]
	bot.command("add", async (ctx) => {
		const groupId = String(ctx.chat.id);
		const split = await getActiveSplit(env.DB, groupId);
		if (!split) return;

		const user = ctx.from!;
		if (!(await isParticipant(env.DB, split.id, user.id))) return;

		const args = ctx.match.trim().split(/\s+/);
		const amount = parseFloat(args[0]);
		if (!args[0] || isNaN(amount) || amount <= 0) return;

		const description = args.slice(1).join(" ") || null;
		const username = user.username ? `@${user.username}` : user.first_name;

		await addExpense(env.DB, split.id, user.id, username, amount, description);

		const desc = description ? ` for ${description}` : "";
		await ctx.reply(`${username} added ${fmt(amount)}${desc}.`);
	});

	// /status — show participants and expenses so far
	bot.command("status", async (ctx) => {
		const groupId = String(ctx.chat.id);
		const split = await getActiveSplit(env.DB, groupId);
		if (!split) return;

		const [participants, expenses] = await Promise.all([
			getParticipants(env.DB, split.id),
			getSplitExpenses(env.DB, split.id),
		]);

		const participantLine =
			participants.length === 0
				? "No participants yet."
				: participants.map((p) => p.username).join(", ");

		const expenseLines =
			expenses.length === 0
				? ["No expenses yet."]
				: expenses.map(
						(e) => `• ${e.username}: ${fmt(e.amount)}${e.description ? ` (${e.description})` : ""}`,
					);

		const total = expenses.reduce((s, e) => s + e.amount, 0);

		await ctx.reply(
			[
				`*${split.title}*`,
				`Participants: ${participantLine}`,
				``,
				`*Expenses:*`,
				...expenseLines,
				...(expenses.length > 0 ? [``, `Total: ${fmt(total)}`] : []),
			].join("\n"),
			{ parse_mode: "Markdown" },
		);
	});

	// /finalize — close split and show settlement
	bot.command("finalize", async (ctx) => {
		const groupId = String(ctx.chat.id);
		const split = await getActiveSplit(env.DB, groupId);
		if (!split) return;

		const [participants, expenses] = await Promise.all([
			getParticipants(env.DB, split.id),
			getSplitExpenses(env.DB, split.id),
		]);

		if (participants.length === 0) return;

		await finalizeSplit(env.DB, split.id);

		const total = expenses.reduce((s, e) => s + e.amount, 0);
		const share = fmt(total / participants.length);
		const settlements = calculateSettlement(expenses, participants);

		const expenseLines =
			expenses.length === 0
				? ["Nobody added any expenses."]
				: expenses.map(
						(e) => `• ${e.username}: ${fmt(e.amount)}${e.description ? ` (${e.description})` : ""}`,
					);

		const settlementLines =
			settlements.length === 0
				? ["Everyone is even!"]
				: settlements.map((s) => `• ${s.from} → ${s.to}: ${fmt(s.amount)}`);

		await ctx.reply(
			[
				`*${split.title} — Final*`,
				`Participants: ${participants.map((p) => p.username).join(", ")}`,
				``,
				`*Expenses:*`,
				...expenseLines,
				`Total: ${fmt(total)} | Each owes: ${share}`,
				``,
				`*Who pays whom:*`,
				...settlementLines,
			].join("\n"),
			{ parse_mode: "Markdown" },
		);
	});

	bot.command("help", (ctx) =>
		ctx.reply(
			[
				"*Split Money Bot*",
				``,
				`/newsplit [title] — start a new split`,
				`/add <amount> [description] — log an expense (must join first)`,
				`/status — show current expenses and participants`,
				`/finalize — calculate and show who pays whom`,
			].join("\n"),
			{ parse_mode: "Markdown" },
		),
	);

	bot.command("start", (ctx) =>
		ctx.reply("Add me to a group and use /newsplit to start splitting expenses."),
	);

	return bot;
}

function fmt(amount: number): string {
	return `$${amount.toFixed(2)}`;
}

export function createWebhookHandler(env: Env) {
	const bot = createBot(env);
	return webhookCallback(bot, "cloudflare-mod", {
		secretToken: env.WEBHOOK_SECRET,
	});
}

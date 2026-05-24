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
import { resolveLang, t } from "./i18n";
import type { Lang } from "./i18n";

export function createBot(env: Env): Bot {
	const bot = new Bot(env.BOT_TOKEN, {
		botInfo: JSON.parse(env.BOT_INFO),
	});

	function splitKeyboard(splitId: number, joinCount: number, lang: Lang): InlineKeyboard {
		const tr = t(lang);
		return new InlineKeyboard()
			.text(joinCount > 0 ? `${tr.joinBtn} (${joinCount})` : tr.joinBtn, `join:${splitId}`)
			.text(tr.participantsBtn, `participants:${splitId}`)
			.text(tr.finalizeBtn, `finalize:${splitId}`);
	}

	// /newsplit [title] — create a new split and post a Join button
	bot.command("newsplit", async (ctx) => {
		const groupId = String(ctx.chat.id);
		const existing = await getActiveSplit(env.DB, groupId);
		if (existing) return;

		const lang = resolveLang(ctx.from?.language_code);
		const tr = t(lang);
		const now = new Date();
		const dateStr = now.toISOString().slice(0, 10);
		const count = await countSplitsOnDate(env.DB, groupId, dateStr);
		const defaultTitle = tr.defaultTitle(now.getUTCDate(), tr.months[now.getUTCMonth()], count + 1);

		const title = ctx.match.trim() || defaultTitle;
		const splitId = await createSplit(env.DB, groupId, title, lang);

		await ctx.reply(tr.splitStarted(title), {
			parse_mode: "Markdown",
			reply_markup: splitKeyboard(splitId, 0, lang),
		});
	});

	// Inline button: join:<splitId>
	bot.callbackQuery(/^join:(\d+)$/, async (ctx) => {
		const splitId = parseInt(ctx.match[1], 10);
		const user = ctx.from;
		const username = user.username ? `@${user.username}` : user.first_name;

		const [result, split] = await Promise.all([
			joinSplit(env.DB, splitId, user.id, username),
			getSplitById(env.DB, splitId),
		]);
		const lang = resolveLang(split?.language);
		const tr = t(lang);

		if (result.meta.changes === 0) {
			await ctx.answerCallbackQuery({ text: tr.alreadyJoined, show_alert: true });
		} else {
			const participants = await getParticipants(env.DB, splitId);
			await ctx.editMessageReplyMarkup({
				reply_markup: splitKeyboard(splitId, participants.length, lang),
			});
			await ctx.answerCallbackQuery({
				text: tr.youJoined(participants.map((p) => p.username).join(", ")),
				show_alert: true,
			});
		}
	});

	// Inline button: participants:<splitId>
	bot.callbackQuery(/^participants:(\d+)$/, async (ctx) => {
		const splitId = parseInt(ctx.match[1], 10);
		const [split, participants] = await Promise.all([
			getSplitById(env.DB, splitId),
			getParticipants(env.DB, splitId),
		]);
		const tr = t(resolveLang(split?.language));
		const text =
			participants.length === 0
				? tr.noParticipants
				: tr.participantsList(participants.length, participants.map((p) => p.username).join(", "));
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
		const tr = t(resolveLang(split?.language));

		if (participants.length === 0) {
			await ctx.answerCallbackQuery({ text: tr.cantFinalize, show_alert: true });
			return;
		}

		await finalizeSplit(env.DB, splitId);
		await ctx.answerCallbackQuery();

		const title = split?.title ?? "Split";
		const participantList = participants.map((p) => p.username).join(", ");
		const total = expenses.reduce((s, e) => s + e.amount, 0);
		const share = fmt(total / participants.length);
		const settlements = calculateSettlement(expenses, participants);

		const expenseLines =
			expenses.length === 0
				? [tr.noExpenses]
				: expenses.map(
						(e) => `• ${e.username}: ${fmt(e.amount)}${e.description ? tr.forDesc(e.description) : ""}`,
					);

		const settlementLines =
			settlements.length === 0
				? [tr.everyoneEven]
				: settlements.map((s) => `• ${s.from} → ${s.to}: ${fmt(s.amount)}`);

		const settlementText = [
			tr.settlementTitle(title),
			tr.participantsLine(participantList),
			``,
			tr.expensesHeader,
			...expenseLines,
			tr.totalLine(fmt(total), share),
			``,
			tr.whoPaysWhom,
			...settlementLines,
		].join("\n");

		await ctx.editMessageText(tr.finalizedShort(title, participantList), { parse_mode: "Markdown" });
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
		const tr = t(resolveLang(split.language));

		await addExpense(env.DB, split.id, user.id, username, amount, description);

		const desc = description ? tr.forDesc(description) : "";
		await ctx.reply(tr.addedExpense(username, fmt(amount), desc));
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
		const tr = t(resolveLang(split.language));

		const participantLine =
			participants.length === 0
				? tr.noParticipants
				: participants.map((p) => p.username).join(", ");

		const expenseLines =
			expenses.length === 0
				? [tr.noExpensesYet]
				: expenses.map(
						(e) => `• ${e.username}: ${fmt(e.amount)}${e.description ? tr.forDesc(e.description) : ""}`,
					);

		const total = expenses.reduce((s, e) => s + e.amount, 0);

		await ctx.reply(
			[
				`*${split.title}*`,
				tr.participantsLine(participantLine),
				``,
				tr.expensesHeader,
				...expenseLines,
				...(expenses.length > 0 ? [``, tr.totalSoFar(fmt(total))] : []),
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
		const tr = t(resolveLang(split.language));

		const total = expenses.reduce((s, e) => s + e.amount, 0);
		const share = fmt(total / participants.length);
		const settlements = calculateSettlement(expenses, participants);

		const expenseLines =
			expenses.length === 0
				? [tr.noExpenses]
				: expenses.map(
						(e) => `• ${e.username}: ${fmt(e.amount)}${e.description ? tr.forDesc(e.description) : ""}`,
					);

		const settlementLines =
			settlements.length === 0
				? [tr.everyoneEven]
				: settlements.map((s) => `• ${s.from} → ${s.to}: ${fmt(s.amount)}`);

		await ctx.reply(
			[
				tr.settlementTitle(split.title),
				tr.participantsLine(participants.map((p) => p.username).join(", ")),
				``,
				tr.expensesHeader,
				...expenseLines,
				tr.totalLine(fmt(total), share),
				``,
				tr.whoPaysWhom,
				...settlementLines,
			].join("\n"),
			{ parse_mode: "Markdown" },
		);
	});

	bot.command("help", (ctx) => {
		const tr = t(resolveLang(ctx.from?.language_code));
		return ctx.reply(tr.help, { parse_mode: "Markdown" });
	});

	bot.command("start", (ctx) => {
		const tr = t(resolveLang(ctx.from?.language_code));
		return ctx.reply(tr.start);
	});

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

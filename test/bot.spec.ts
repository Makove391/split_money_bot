import { describe, it, expect } from "vitest";
import { buildHistoryText, buildHistoryKeyboard, PAGE_SIZE } from "../src/bot";
import { t } from "../src/i18n";
import type { SplitSummary } from "../src/db";

function makeSplit(id: number, title: string, total = 0, participant_count = 1): SplitSummary {
	return { id, title, language: "en", total, participant_count };
}

describe("buildHistoryText", () => {
	it("returns empty message when there are no splits", () => {
		expect(buildHistoryText([], 0, 0, t("en"))).toBe(t("en").historyEmpty);
	});

	it("includes split titles and page info", () => {
		const splits = [makeSplit(1, "Beach trip", 90, 3)];
		const text = buildHistoryText(splits, 0, 1, t("en"));
		expect(text).toContain("Beach trip");
		expect(text).toContain("Page 1 of 1");
	});

	it("numbers items starting from offset + 1", () => {
		const splits = [makeSplit(6, "Dinner", 60, 2)];
		const text = buildHistoryText(splits, PAGE_SIZE, PAGE_SIZE + 1, t("en"));
		expect(text).toContain(`${PAGE_SIZE + 1}. Dinner`);
	});

	it("calculates page number correctly on second page", () => {
		const splits = [makeSplit(6, "Dinner")];
		const text = buildHistoryText(splits, PAGE_SIZE, PAGE_SIZE + 1, t("en"));
		expect(text).toContain("Page 2 of 2");
	});

	it("works with Ukrainian translations", () => {
		const splits = [makeSplit(1, "Поїздка")];
		const text = buildHistoryText(splits, 0, 1, t("uk"));
		expect(text).toContain("Поїздка");
		expect(text).toContain("Сторінка 1 з 1");
	});
});

describe("buildHistoryKeyboard", () => {
	it("adds one settlement button per split", () => {
		const splits = [makeSplit(1, "Beach trip"), makeSplit(2, "Dinner")];
		const kb = buildHistoryKeyboard(splits, 0, 2, "en");
		expect(kb.inline_keyboard[0][0]).toMatchObject({ text: "Beach trip", callback_data: "settlement:1" });
		expect(kb.inline_keyboard[1][0]).toMatchObject({ text: "Dinner", callback_data: "settlement:2" });
	});

	it("shows next button when more pages exist", () => {
		const splits = [makeSplit(1, "Trip")];
		const kb = buildHistoryKeyboard(splits, 0, PAGE_SIZE + 1, "en");
		const navRow = kb.inline_keyboard[kb.inline_keyboard.length - 1];
		expect(navRow.some((btn) => "callback_data" in btn && btn.callback_data === `history:${PAGE_SIZE}:en`)).toBe(true);
	});

	it("shows prev button when not on the first page", () => {
		const splits = [makeSplit(6, "Trip")];
		const kb = buildHistoryKeyboard(splits, PAGE_SIZE, PAGE_SIZE + 1, "en");
		const navRow = kb.inline_keyboard[kb.inline_keyboard.length - 1];
		expect(navRow.some((btn) => "callback_data" in btn && btn.callback_data === `history:0:en`)).toBe(true);
	});

	it("shows no nav buttons on a single page", () => {
		const splits = [makeSplit(1, "Trip")];
		const kb = buildHistoryKeyboard(splits, 0, 1, "en");
		expect(kb.inline_keyboard).toHaveLength(1);
	});

	it("shows both prev and next buttons in the middle of pagination", () => {
		const splits = [makeSplit(6, "Trip")];
		const kb = buildHistoryKeyboard(splits, PAGE_SIZE, PAGE_SIZE * 3, "en");
		const navRow = kb.inline_keyboard[kb.inline_keyboard.length - 1];
		expect(navRow).toHaveLength(2);
	});
});

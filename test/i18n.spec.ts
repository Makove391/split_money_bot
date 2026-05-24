import { describe, it, expect } from "vitest";
import { resolveLang, t } from "../src/i18n";

describe("resolveLang", () => {
	it("passes through supported languages", () => {
		expect(resolveLang("en")).toBe("en");
		expect(resolveLang("uk")).toBe("uk");
		expect(resolveLang("pl")).toBe("pl");
	});

	it("falls back to en for unsupported language codes", () => {
		expect(resolveLang("fr")).toBe("en");
		expect(resolveLang("de")).toBe("en");
		expect(resolveLang("zh")).toBe("en");
	});

	it("falls back to en for undefined", () => {
		expect(resolveLang(undefined)).toBe("en");
	});
});

describe("t", () => {
	it("returns distinct join button labels per language", () => {
		expect(t("en").joinBtn).toBe("Join");
		expect(t("uk").joinBtn).toBe("Приєднатися");
		expect(t("pl").joinBtn).toBe("Dołącz");
	});

	it("youJoined includes /add hint in all languages", () => {
		const list = "@alice, @bob";
		expect(t("en").youJoined(list)).toContain("/add");
		expect(t("uk").youJoined(list)).toContain("/add");
		expect(t("pl").youJoined(list)).toContain("/add");
	});

	it("youJoined includes the participant list", () => {
		const list = "@alice, @bob";
		expect(t("en").youJoined(list)).toContain(list);
		expect(t("uk").youJoined(list)).toContain(list);
		expect(t("pl").youJoined(list)).toContain(list);
	});

	it("historyItem formats n, title, total, participant count", () => {
		expect(t("en").historyItem(3, "Beach trip", "$60.00", 2)).toBe("3. Beach trip — $60.00 (2)");
	});

	it("historyPage formats current and total pages", () => {
		expect(t("en").historyPage(2, 5)).toBe("Page 2 of 5");
		expect(t("uk").historyPage(1, 3)).toBe("Сторінка 1 з 3");
	});

	it("defaultTitle uses day, month name, and split number", () => {
		const tr = t("en");
		expect(tr.defaultTitle(15, tr.months[0], 1)).toBe("Split 15 Jan #1");
	});

	it("splitAlreadyActive is defined in all languages", () => {
		expect(t("en").splitAlreadyActive).toBeTruthy();
		expect(t("uk").splitAlreadyActive).toBeTruthy();
		expect(t("pl").splitAlreadyActive).toBeTruthy();
	});

	it("splitAlreadyActive mentions /finalize in all languages", () => {
		expect(t("en").splitAlreadyActive).toContain("/finalize");
		expect(t("uk").splitAlreadyActive).toContain("/finalize");
		expect(t("pl").splitAlreadyActive).toContain("/finalize");
	});
});

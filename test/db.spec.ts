import { describe, it, expect } from "vitest";
import { calculateSettlement, getFinalizedSplits, countFinalizedSplits } from "../src/db";
import type { Expense, SplitParticipant, SplitSummary } from "../src/db";

function mockDb(firstResult: unknown = null, allResults: unknown[] = []): D1Database {
	const stmt: any = {
		bind: (..._args: unknown[]) => stmt,
		first: async () => firstResult,
		all: async () => ({ results: allResults }),
		run: async () => ({ meta: { changes: 1 }, success: true }),
	};
	return { prepare: (_sql: string) => stmt } as unknown as D1Database;
}

function makeParticipant(userId: number, username: string): SplitParticipant {
	return { split_id: 1, user_id: userId, username, joined_at: 0 };
}

function makeExpense(userId: number, username: string, amount: number, description?: string): Expense {
	return { id: 0, split_id: 1, user_id: userId, username, amount, description: description ?? null, created_at: 0 };
}

describe("calculateSettlement", () => {
	it("returns empty when no participants", () => {
		expect(calculateSettlement([], [])).toEqual([]);
	});

	it("returns empty when everyone is even", () => {
		const participants = [makeParticipant(1, "Alice"), makeParticipant(2, "Bob")];
		const expenses = [makeExpense(1, "Alice", 50), makeExpense(2, "Bob", 50)];
		expect(calculateSettlement(expenses, participants)).toEqual([]);
	});

	it("one person paid for everything", () => {
		const participants = [makeParticipant(1, "Alice"), makeParticipant(2, "Bob")];
		const expenses = [makeExpense(1, "Alice", 100)];
		const result = calculateSettlement(expenses, participants);
		expect(result).toEqual([{ from: "Bob", to: "Alice", amount: 50 }]);
	});

	it("three people, one paid for all", () => {
		const participants = [
			makeParticipant(1, "Alice"),
			makeParticipant(2, "Bob"),
			makeParticipant(3, "Carol"),
		];
		const expenses = [makeExpense(1, "Alice", 90)];
		const result = calculateSettlement(expenses, participants);
		expect(result).toHaveLength(2);
		expect(result.every((s) => s.to === "Alice")).toBe(true);
		expect(result.every((s) => s.amount === 30)).toBe(true);
	});

	it("participant who joined but paid nothing still owes their share", () => {
		const participants = [makeParticipant(1, "Alice"), makeParticipant(2, "Bob"), makeParticipant(3, "Carol")];
		const expenses = [makeExpense(1, "Alice", 60), makeExpense(2, "Bob", 60)];
		const result = calculateSettlement(expenses, participants);
		expect(result).toContainEqual({ from: "Carol", to: "Alice", amount: 20 });
		expect(result).toContainEqual({ from: "Carol", to: "Bob", amount: 20 });
	});
});

describe("getFinalizedSplits", () => {
	it("returns splits from db", async () => {
		const splits: SplitSummary[] = [
			{ id: 1, title: "Beach trip", language: "en", participant_count: 3, total: 90 },
			{ id: 2, title: "Dinner", language: "uk", participant_count: 2, total: 40 },
		];
		const result = await getFinalizedSplits(mockDb(null, splits), "group1", 5, 0);
		expect(result).toEqual(splits);
	});

	it("returns empty array when there are no finalized splits", async () => {
		const result = await getFinalizedSplits(mockDb(null, []), "group1", 5, 0);
		expect(result).toEqual([]);
	});
});

describe("countFinalizedSplits", () => {
	it("returns the count from db", async () => {
		const result = await countFinalizedSplits(mockDb({ count: 7 }), "group1");
		expect(result).toBe(7);
	});

	it("returns 0 when db returns null", async () => {
		const result = await countFinalizedSplits(mockDb(null), "group1");
		expect(result).toBe(0);
	});
});

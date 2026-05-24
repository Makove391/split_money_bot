import { describe, it, expect } from "vitest";
import { calculateSettlement } from "../src/db";
import type { Expense, SplitParticipant } from "../src/db";

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

export type SplitStatus = "active" | "finalized";

export interface Split {
	id: number;
	group_id: string;
	title: string;
	status: SplitStatus;
	language: string;
	created_at: number;
}

export interface SplitParticipant {
	split_id: number;
	user_id: number;
	username: string;
	joined_at: number;
}

export interface Expense {
	id: number;
	split_id: number;
	user_id: number;
	username: string;
	amount: number;
	description: string | null;
	created_at: number;
}

export interface Settlement {
	from: string;
	to: string;
	amount: number;
}

export function getSplitById(db: D1Database, splitId: number): Promise<Split | null> {
	return db.prepare("SELECT * FROM splits WHERE id = ?").bind(splitId).first<Split>();
}

export interface SplitSummary {
	id: number;
	title: string;
	language: string;
	participant_count: number;
	total: number;
}

export async function getFinalizedSplits(
	db: D1Database,
	groupId: string,
	limit: number,
	offset: number,
): Promise<SplitSummary[]> {
	const result = await db
		.prepare(
			`SELECT s.id, s.title, s.language,
			  COUNT(DISTINCT sp.user_id) AS participant_count,
			  COALESCE(SUM(e.amount), 0) AS total
			 FROM splits s
			 LEFT JOIN split_participants sp ON sp.split_id = s.id
			 LEFT JOIN expenses e ON e.split_id = s.id
			 WHERE s.group_id = ? AND s.status = 'finalized'
			 GROUP BY s.id
			 ORDER BY s.created_at DESC
			 LIMIT ? OFFSET ?`,
		)
		.bind(groupId, limit, offset)
		.all<SplitSummary>();
	return result.results;
}

export async function countFinalizedSplits(db: D1Database, groupId: string): Promise<number> {
	const result = await db
		.prepare("SELECT COUNT(*) AS count FROM splits WHERE group_id = ? AND status = 'finalized'")
		.bind(groupId)
		.first<{ count: number }>();
	return result?.count ?? 0;
}

export async function countSplitsOnDate(db: D1Database, groupId: string, date: string): Promise<number> {
	const result = await db
		.prepare("SELECT COUNT(*) as count FROM splits WHERE group_id = ? AND date(created_at, 'unixepoch') = ?")
		.bind(groupId, date)
		.first<{ count: number }>();
	return result?.count ?? 0;
}

export function getActiveSplit(db: D1Database, groupId: string): Promise<Split | null> {
	return db
		.prepare("SELECT * FROM splits WHERE group_id = ? AND status = 'active' LIMIT 1")
		.bind(groupId)
		.first<Split>();
}

export async function createSplit(
	db: D1Database,
	groupId: string,
	title: string,
	language: string,
): Promise<number> {
	const result = await db
		.prepare("INSERT INTO splits (group_id, title, language) VALUES (?, ?, ?) RETURNING id")
		.bind(groupId, title, language)
		.first<{ id: number }>();
	return result!.id;
}

export function finalizeSplit(db: D1Database, splitId: number): Promise<D1Result> {
	return db
		.prepare("UPDATE splits SET status = 'finalized' WHERE id = ?")
		.bind(splitId)
		.run();
}

export function joinSplit(
	db: D1Database,
	splitId: number,
	userId: number,
	username: string,
): Promise<D1Result> {
	return db
		.prepare(
			"INSERT OR IGNORE INTO split_participants (split_id, user_id, username) VALUES (?, ?, ?)",
		)
		.bind(splitId, userId, username)
		.run();
}

export async function getParticipants(db: D1Database, splitId: number): Promise<SplitParticipant[]> {
	const result = await db
		.prepare("SELECT * FROM split_participants WHERE split_id = ? ORDER BY joined_at ASC")
		.bind(splitId)
		.all<SplitParticipant>();
	return result.results;
}

export async function isParticipant(db: D1Database, splitId: number, userId: number): Promise<boolean> {
	const result = await db
		.prepare("SELECT 1 FROM split_participants WHERE split_id = ? AND user_id = ?")
		.bind(splitId, userId)
		.first();
	return result !== null;
}

export function addExpense(
	db: D1Database,
	splitId: number,
	userId: number,
	username: string,
	amount: number,
	description: string | null,
): Promise<D1Result> {
	return db
		.prepare(
			"INSERT INTO expenses (split_id, user_id, username, amount, description) VALUES (?, ?, ?, ?, ?)",
		)
		.bind(splitId, userId, username, amount, description)
		.run();
}

export async function getSplitExpenses(db: D1Database, splitId: number): Promise<Expense[]> {
	const result = await db
		.prepare("SELECT * FROM expenses WHERE split_id = ? ORDER BY created_at ASC")
		.bind(splitId)
		.all<Expense>();
	return result.results;
}

export function calculateSettlement(
	expenses: Expense[],
	participants: SplitParticipant[],
): Settlement[] {
	if (participants.length === 0) return [];

	const paid: Record<number, number> = {};
	for (const e of expenses) {
		paid[e.user_id] = (paid[e.user_id] ?? 0) + e.amount;
	}

	const total = Object.values(paid).reduce((s, v) => s + v, 0);
	const share = total / participants.length;

	const balances = participants.map((p) => ({
		name: p.username,
		balance: Math.round(((paid[p.user_id] ?? 0) - share) * 100) / 100,
	}));

	const creditors = balances.filter((b) => b.balance > 0).sort((a, b) => b.balance - a.balance);
	const debtors = balances.filter((b) => b.balance < 0).sort((a, b) => a.balance - b.balance);

	const settlements: Settlement[] = [];
	let ci = 0;
	let di = 0;

	while (ci < creditors.length && di < debtors.length) {
		const credit = creditors[ci];
		const debtor = debtors[di];
		const amount = Math.round(Math.min(credit.balance, -debtor.balance) * 100) / 100;

		if (amount > 0) {
			settlements.push({ from: debtor.name, to: credit.name, amount });
		}

		credit.balance -= amount;
		debtor.balance += amount;

		if (Math.abs(credit.balance) < 0.01) ci++;
		if (Math.abs(debtor.balance) < 0.01) di++;
	}

	return settlements;
}

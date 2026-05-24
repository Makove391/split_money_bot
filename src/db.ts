export async function getUser(db: D1Database, telegramId: number) {
	return db
		.prepare("SELECT * FROM users WHERE telegram_id = ?")
		.bind(telegramId)
		.first();
}

export async function upsertUser(db: D1Database, telegramId: number, username: string | undefined) {
	return db
		.prepare(
			"INSERT INTO users (telegram_id, username) VALUES (?, ?) ON CONFLICT(telegram_id) DO UPDATE SET username = excluded.username",
		)
		.bind(telegramId, username ?? null)
		.run();
}

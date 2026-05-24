export type Lang = "en" | "uk" | "pl";

const SUPPORTED = new Set<string>(["en", "uk", "pl"]);

export function resolveLang(code: string | undefined): Lang {
	if (code && SUPPORTED.has(code)) return code as Lang;
	return "en";
}

type Tr = {
	months: readonly string[];
	defaultTitle: (day: number, month: string, n: number) => string;
	joinBtn: string;
	participantsBtn: string;
	finalizeBtn: string;
	splitStarted: (title: string) => string;
	alreadyJoined: string;
	youJoined: (list: string) => string;
	noParticipants: string;
	participantsList: (count: number, list: string) => string;
	cantFinalize: string;
	finalizedShort: (title: string, list: string) => string;
	settlementTitle: (title: string) => string;
	participantsLine: (list: string) => string;
	expensesHeader: string;
	noExpenses: string;
	totalLine: (total: string, share: string) => string;
	whoPaysWhom: string;
	everyoneEven: string;
	addedExpense: (username: string, amount: string, desc: string) => string;
	forDesc: (desc: string) => string;
	noExpensesYet: string;
	totalSoFar: (total: string) => string;
	help: string;
	start: string;
};

const en: Tr = {
	months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
	defaultTitle: (day, month, n) => `Split ${day} ${month} #${n}`,
	joinBtn: "Join",
	participantsBtn: "👥 Participants",
	finalizeBtn: "✅ Finalize",
	splitStarted: (title) =>
		`*${title}* started!\nTap Join to participate, then use /add to log your expenses.`,
	alreadyJoined: "You've already joined this split.",
	youJoined: (list) => `You joined the split! Participants: ${list}`,
	noParticipants: "No participants yet.",
	participantsList: (count, list) => `Participants (${count}):\n${list}`,
	cantFinalize: "Can't finalize — nobody has joined yet.",
	finalizedShort: (title, list) => `*${title}* ✅ Finalized\nParticipants: ${list}`,
	settlementTitle: (title) => `*${title} — Final*`,
	participantsLine: (list) => `Participants: ${list}`,
	expensesHeader: "*Expenses:*",
	noExpenses: "Nobody added any expenses.",
	totalLine: (total, share) => `Total: ${total} | Each owes: ${share}`,
	whoPaysWhom: "*Who pays whom:*",
	everyoneEven: "Everyone is even!",
	addedExpense: (username, amount, desc) => `${username} added ${amount}${desc}.`,
	forDesc: (desc) => ` for ${desc}`,
	noExpensesYet: "No expenses yet.",
	totalSoFar: (total) => `Total: ${total}`,
	help: [
		"*Split Money Bot*",
		"",
		"/newsplit [title] — start a new split",
		"/add <amount> [description] — log an expense (must join first)",
		"/status — show current expenses and participants",
		"/finalize — calculate and show who pays whom",
	].join("\n"),
	start: "Add me to a group and use /newsplit to start splitting expenses.",
};

const uk: Tr = {
	months: ["Січ", "Лют", "Бер", "Кві", "Тра", "Чер", "Лип", "Сер", "Вер", "Жов", "Лис", "Гру"],
	defaultTitle: (day, month, n) => `Розподіл ${day} ${month} #${n}`,
	joinBtn: "Приєднатися",
	participantsBtn: "👥 Учасники",
	finalizeBtn: "✅ Завершити",
	splitStarted: (title) =>
		`*${title}* розпочато!\nНатисни Приєднатися щоб взяти участь, потім /add щоб додати витрати.`,
	alreadyJoined: "Ти вже приєднався до цього розподілу.",
	youJoined: (list) => `Ти приєднався! Учасники: ${list}`,
	noParticipants: "Поки немає учасників.",
	participantsList: (count, list) => `Учасники (${count}):\n${list}`,
	cantFinalize: "Неможливо завершити — ніхто ще не приєднався.",
	finalizedShort: (title, list) => `*${title}* ✅ Завершено\nУчасники: ${list}`,
	settlementTitle: (title) => `*${title} — Підсумок*`,
	participantsLine: (list) => `Учасники: ${list}`,
	expensesHeader: "*Витрати:*",
	noExpenses: "Ніхто не додав витрат.",
	totalLine: (total, share) => `Разом: ${total} | Кожен винен: ${share}`,
	whoPaysWhom: "*Хто кому платить:*",
	everyoneEven: "Всі в розрахунку!",
	addedExpense: (username, amount, desc) => `${username} додав ${amount}${desc}.`,
	forDesc: (desc) => ` за ${desc}`,
	noExpensesYet: "Витрат поки немає.",
	totalSoFar: (total) => `Разом: ${total}`,
	help: [
		"*Split Money Bot*",
		"",
		"/newsplit [назва] — почати новий розподіл",
		"/add <сума> [опис] — додати витрату (спочатку приєднайся)",
		"/status — показати поточні витрати та учасників",
		"/finalize — підрахувати та показати хто кому платить",
	].join("\n"),
	start: "Додай мене до групи і використовуй /newsplit щоб почати ділити витрати.",
};

const pl: Tr = {
	months: ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"],
	defaultTitle: (day, month, n) => `Podział ${day} ${month} #${n}`,
	joinBtn: "Dołącz",
	participantsBtn: "👥 Uczestnicy",
	finalizeBtn: "✅ Zakończ",
	splitStarted: (title) =>
		`*${title}* rozpoczęty!\nNaciśnij Dołącz, aby uczestniczyć, potem użyj /add do dodawania wydatków.`,
	alreadyJoined: "Już dołączyłeś do tego podziału.",
	youJoined: (list) => `Dołączyłeś! Uczestnicy: ${list}`,
	noParticipants: "Brak uczestników.",
	participantsList: (count, list) => `Uczestnicy (${count}):\n${list}`,
	cantFinalize: "Nie można zakończyć — nikt jeszcze nie dołączył.",
	finalizedShort: (title, list) => `*${title}* ✅ Zakończony\nUczestnicy: ${list}`,
	settlementTitle: (title) => `*${title} — Podsumowanie*`,
	participantsLine: (list) => `Uczestnicy: ${list}`,
	expensesHeader: "*Wydatki:*",
	noExpenses: "Nikt nie dodał żadnych wydatków.",
	totalLine: (total, share) => `Razem: ${total} | Każdy winien: ${share}`,
	whoPaysWhom: "*Kto komu płaci:*",
	everyoneEven: "Wszyscy są rozliczeni!",
	addedExpense: (username, amount, desc) => `${username} dodał ${amount}${desc}.`,
	forDesc: (desc) => ` za ${desc}`,
	noExpensesYet: "Brak wydatków.",
	totalSoFar: (total) => `Razem: ${total}`,
	help: [
		"*Split Money Bot*",
		"",
		"/newsplit [tytuł] — rozpocznij nowy podział",
		"/add <kwota> [opis] — dodaj wydatek (najpierw dołącz)",
		"/status — pokaż aktualne wydatki i uczestników",
		"/finalize — oblicz i pokaż kto komu płaci",
	].join("\n"),
	start: "Dodaj mnie do grupy i użyj /newsplit, aby zacząć dzielić wydatki.",
};

const TRANSLATIONS: Record<Lang, Tr> = { en, uk, pl };

export function t(lang: Lang): Tr {
	return TRANSLATIONS[lang];
}

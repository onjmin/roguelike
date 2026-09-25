// 中断セーブと冒険の記録（端末ごとに localStorage へ保存）。
//
// - 中断セーブは1つだけ。倒れたら・持ち帰ったら消す（トルネコと同じく、やり直しはできない）。
// - 記録は最後の50回ぶん。通算（もぐった回数・持ち帰った回数・いちばん深い階）は別に持つ
//   （50回より古い記録が押し出されても、通算は減らない）。
// - プライベートモード等で保存できなくても遊べるように、読み書きはすべて try/catch。

import { ITEMS } from "../core/data/items";
import { MONSTERS } from "../core/data/monsters";
import { SAVE_VERSION } from "../core/run";
import { deserializeRun, serializeRun } from "../core/serial";
import type { RunState } from "../core/types";

const PREFIX = "kiriko-roguelike/";
const RUN_KEY = `${PREFIX}run`;
const RECORDS_KEY = `${PREFIX}records`;
const STATS_KEY = `${PREFIX}stats`;
const RECORDS_MAX = 50;

// ───────────────────────── 中断セーブ ─────────────────────────

export const hasRunSave = (): boolean => {
	try {
		return !!localStorage.getItem(RUN_KEY);
	} catch {
		return false;
	}
};

export const clearRun = (): void => {
	try {
		localStorage.removeItem(RUN_KEY);
	} catch {
		// 消せなくても続ける（次の saveRun で上書きされる）
	}
};

/**
 * 中断セーブ（数ターンごと・ページを離れるとき）。
 * 終わった冒険を渡されたら保存せず、記録に残して中断セーブを消す。
 * 倒れた直後にタブを閉じても、古い中断セーブから やり直せないように（記録も失わないように）。
 */
/** 開発用に始めた冒険のシードの頭（保存も記録もしない）。 */
export const DEBUG_SEED = "debug:";

export const saveRun = (s: RunState): void => {
	if (s.seed.startsWith(DEBUG_SEED)) return;
	if (s.end) {
		addRecord(recordFromRun(s));
		clearRun();
		return;
	}
	const text = serializeRun(s);
	try {
		localStorage.setItem(RUN_KEY, text);
	} catch {
		// 容量不足のときは、古い中断セーブを消してから もう一度（古いのが残ると、
		// 読み直したときに 何階も前へ 巻きもどってしまう）
		try {
			localStorage.removeItem(RUN_KEY);
			localStorage.setItem(RUN_KEY, text);
		} catch {
			// プライベートモードなど。中断はできないが遊べる
		}
	}
};

/** 中断セーブを読む。無い・壊れている・版がちがう・終わっている なら null。 */
export const loadRun = (): RunState | null => {
	try {
		const raw = localStorage.getItem(RUN_KEY);
		if (!raw) return null;
		const s = deserializeRun(raw);
		if (s.v !== SAVE_VERSION || !s.player || !s.floor || s.end) return null;
		// あとの版で消えた モンスター・道具が入っていたら 読まない（途中で落ちるより良い）
		const items = [
			...s.player.items,
			...s.floor.items.map((i) => i.item),
			...s.floor.monsters.flatMap((m) => (m.carry ? [m.carry] : [])),
		];
		if (items.some((i) => !ITEMS[i.kind])) return null;
		if (s.floor.monsters.some((m) => !MONSTERS[m.kind])) return null;
		return s;
	} catch {
		return null;
	}
};

// ───────────────────────── 冒険の記録 ─────────────────────────

export type RunRecord = {
	/** 終わった時刻（ms）。 */
	at: number;
	kind: "dead" | "clear";
	cause: string;
	/** 終わった階。 */
	depth: number;
	/** いちばん深く もぐった階。 */
	maxDepth: number;
	lv: number;
	turn: number;
	/** 倒したモンスターの数。 */
	kills: number;
	/** 見た札の数。 */
	seen: number;
	/** 見ないまま流れた札の数。 */
	flowed: number;
	/** 帰り道（原盤を持って上っている）だった。 */
	returning: boolean;
	seed: string;
};

type Stats = { runs: number; clears: number; best: number };

export const recordFromRun = (s: RunState): RunRecord => {
	// 終わっていない冒険は渡されないはずだが、渡されても落ちないように
	const end = s.end ?? {
		kind: "dead" as const,
		cause: "冒険を　やめた",
		depth: s.depth,
		turn: s.turn,
	};
	return {
		at: Date.now(),
		kind: end.kind,
		cause: end.cause,
		depth: end.depth,
		maxDepth: s.stats.maxDepth,
		lv: s.player.lv,
		turn: end.turn,
		kills: Object.values(s.kills).reduce((a, n) => a + n, 0),
		// 山札の札だけを数える（原盤・始めのパン・分けて飛ばした矢は札ではない）
		seen: s.seen.filter((u) => s.cardKind[u] !== undefined).length,
		flowed: s.flowed,
		returning: s.returning,
		seed: s.seed,
	};
};

const isRecord = (r: unknown): r is RunRecord => {
	if (!r || typeof r !== "object") return false;
	const o = r as Partial<RunRecord>;
	return (
		(o.kind === "dead" || o.kind === "clear") &&
		typeof o.at === "number" &&
		typeof o.depth === "number" &&
		typeof o.cause === "string"
	);
};

/** 記録（新しい順）。 */
export const loadRecords = (): RunRecord[] => {
	try {
		const raw = localStorage.getItem(RECORDS_KEY);
		if (!raw) return [];
		const list = JSON.parse(raw) as unknown;
		return Array.isArray(list) ? list.filter(isRecord) : [];
	} catch {
		return [];
	}
};

const loadStats = (): Stats | null => {
	try {
		const raw = localStorage.getItem(STATS_KEY);
		if (!raw) return null;
		const o = JSON.parse(raw) as Partial<Stats>;
		if (
			typeof o.runs !== "number" ||
			typeof o.clears !== "number" ||
			typeof o.best !== "number"
		)
			return null;
		return { runs: o.runs, clears: o.clears, best: o.best };
	} catch {
		return null;
	}
};

/** 通算。best はいちばん深く もぐった階。 */
export const runStats = (): Stats => {
	const saved = loadStats();
	if (saved) return saved;
	// 通算が消えていたら、残っている記録から数え直す
	const list = loadRecords();
	return {
		runs: list.length,
		clears: list.filter((r) => r.kind === "clear").length,
		best: list.reduce((a, r) => Math.max(a, r.maxDepth), 0),
	};
};

/**
 * 記録を足す（最後の50回ぶんを残す）。
 * 同じ冒険の終わりを2回足さない（saveRun と記録の画面の両方から呼ばれることがある）。
 */
export const addRecord = (r: RunRecord): void => {
	if (r.seed.startsWith(DEBUG_SEED)) return;
	const list = loadRecords();
	const last = list[0];
	if (
		last &&
		last.seed === r.seed &&
		last.turn === r.turn &&
		last.kind === r.kind
	)
		return;
	const stats = runStats();
	list.unshift(r);
	if (list.length > RECORDS_MAX) list.length = RECORDS_MAX;
	const next: Stats = {
		runs: stats.runs + 1,
		clears: stats.clears + (r.kind === "clear" ? 1 : 0),
		best: Math.max(stats.best, r.maxDepth),
	};
	try {
		localStorage.setItem(RECORDS_KEY, JSON.stringify(list));
		localStorage.setItem(STATS_KEY, JSON.stringify(next));
	} catch {
		// 保存できなくても遊べる
	}
};

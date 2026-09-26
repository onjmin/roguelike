// 中断セーブと冒険の記録（端末ごとに localStorage へ保存）。
//
// - 中断セーブは1つだけ。倒れたら・持ち帰ったら消す（トルネコと同じく、やり直しはできない）。
// - 記録は最後の50回ぶん。通算（もぐった回数・持ち帰った回数・いちばん深い階）は別に持つ
//   （50回より古い記録が押し出されても、通算は減らない）。
// - プライベートモード等で保存できなくても遊べるように、読み書きはすべて try/catch。

import { DUNGEON_IDS, DUNGEONS } from "../core/data/dungeons";
import { ITEMS } from "../core/data/items";
import { MONSTERS } from "../core/data/monsters";
import { FAKE_NAMES, OLD_FAKE_NAMES } from "../core/data/names";
import { defOf } from "../core/item";
import { migrateRun } from "../core/run";
import { deserializeRun, serializeRun } from "../core/serial";
import { nextStage, priceOf, STORAGE_CAP } from "../core/town";
import type { DungeonId, Item, RunState } from "../core/types";

const PREFIX = "kiriko-roguelike/";
const RUN_KEY = `${PREFIX}run`;
const RECORDS_KEY = `${PREFIX}records`;
const STATS_KEY = `${PREFIX}stats`;
const BOOK_KEY = `${PREFIX}book`;
const REPLAYS_KEY = `${PREFIX}replays`;
const PROGRESS_KEY = `${PREFIX}progress`;
const TOWN_KEY = `${PREFIX}town`;
const RECORDS_MAX = 50;

/**
 * セーブデータを ぜんぶ 消す（はじめから やりなおす）。この ゲームの 記録は ぜんぶ PREFIX の 下に あるので、
 * せってい（音・十字キー）だけ のこして まとめて 消す。消したら 読みなおして 村の はじめから。
 */
export const wipeSaves = (): void => {
	try {
		const keys: string[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const k = localStorage.key(i);
			if (k?.startsWith(PREFIX) && k !== `${PREFIX}settings`) keys.push(k);
		}
		for (const k of keys) localStorage.removeItem(k);
	} catch {
		// 使えない ときは 何もしない
	}
};
/** リプレイを残す数（新しい順。1つ数十KB）。 */
export const REPLAYS_KEEP = 20;

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
		// 先に中断セーブを消す（中にリプレイの写しが入っているので、記録・リプレイの場所を空ける。
		// ここは続けて動くので、途中でタブを閉じられて古い中断セーブだけ残ることはない）
		clearRun();
		const fresh = addRecord(recordFromRun(s));
		addReplay(s);
		// 同じ終わりを 二度 数えない（演出の途中で タブを隠す・閉じるたびに 保存が来ても、
		// 倒れた回数・図鑑・町の売上が ふえないように）
		if (!fresh) return;
		addBookKills(s.kills);
		// 持ち帰った（目的の品・帰還スレ）なら、持ち物を 町へ（倉庫にあずける・売る は この次の画面で）。
		// 町が まだ無ければ この冒険の前の進み具合から作るので、noteRunEnd より先に
		if (s.end.kind !== "dead") addPendingReturn(s);
		noteRunEnd(s.dungeon, s.end.kind);
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
		} catch {
			// 消せなくても続ける
		}
		// それでも入らなければ、残してあるリプレイを古いものから捨てる（見返しより中断セーブが大事）
		const replays = loadReplays();
		for (;;) {
			try {
				localStorage.setItem(RUN_KEY, text);
				return;
			} catch {
				if (!replays.length) return; // プライベートモードなど。中断はできないが遊べる
				replays.pop();
				try {
					if (replays.length)
						localStorage.setItem(REPLAYS_KEY, JSON.stringify(replays));
					else localStorage.removeItem(REPLAYS_KEY);
				} catch {
					replays.length = 0;
					try {
						localStorage.removeItem(REPLAYS_KEY);
					} catch {
						// あきらめる
					}
				}
			}
		}
	}
};

/** 中断セーブを読む。無い・壊れている・版がちがう・終わっている なら null。 */
export const loadRun = (): RunState | null => {
	try {
		const raw = localStorage.getItem(RUN_KEY);
		if (!raw) return null;
		const s = migrateRun(deserializeRun(raw));
		if (!s?.player || !s.floor || s.end) return null;
		// あとの版で消えた モンスター・道具が入っていたら 読まない（途中で落ちるより良い）
		const items = [
			...s.player.items,
			...s.floor.items.map((i) => i.item),
			...s.floor.monsters.flatMap((m) => (m.carry ? [m.carry] : [])),
		];
		if (items.some((i) => !ITEMS[i.kind])) return null;
		if (s.floor.monsters.some((m) => !MONSTERS[m.kind])) return null;
		// 巻物を「スレ」と呼ぶ前の中断セーブ：未識別の名前を今の呼び方にそろえる
		for (const [k, v] of Object.entries(s.ids.fake))
			s.ids.fake[k] = v.replace(/の巻物$/, "スレ");
		// 前の版の 未識別名（草・杖・指輪）の中断セーブ：同じ番目の 今の名前に
		for (const [k, v] of Object.entries(s.ids.fake)) {
			const cat = ITEMS[k]?.cat;
			if (!cat || FAKE_NAMES[cat]?.includes(v)) continue;
			for (const old of OLD_FAKE_NAMES[cat] ?? []) {
				const now = FAKE_NAMES[cat]?.[old.indexOf(v)];
				if (old.includes(v) && now) {
					s.ids.fake[k] = now;
					break;
				}
			}
		}
		return s;
	} catch {
		return null;
	}
};

// ───────────────────────── 冒険の記録 ─────────────────────────

export type RunRecord = {
	/** 終わった時刻（ms）。 */
	at: number;
	kind: "dead" | "clear" | "escape";
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
	/** 帰り道（目的の品を持って上っている）だった。 */
	returning: boolean;
	seed: string;
	/** どのダンジョンか（ダンジョンが1つだったころの記録には無い＝本編）。 */
	dungeon?: DungeonId;
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
		dungeon: s.dungeon,
	};
};

const isRecord = (r: unknown): r is RunRecord => {
	if (!r || typeof r !== "object") return false;
	const o = r as Partial<RunRecord>;
	return (
		(o.kind === "dead" || o.kind === "clear" || o.kind === "escape") &&
		typeof o.at === "number" &&
		typeof o.depth === "number" &&
		typeof o.cause === "string"
	);
};

/**
 * 前の版の 名前を 今の 名前に（とうすこ → ぷゆゆ。メタルとうすこ → メタルぷゆゆ も これで 直る。くさったパン → チギュリパン。毒カボチャ → まんぜう軍。錆び亡者 → 風呂キャンセル界隈。ネットに ゆかりの ない 16体と 過疎 → かまってちゃん も 読みかえる。影は 1文字なので「影に」で 結ぶ）。
 * 記録と リプレイの 両方で 直す（replayMatches が 死因の 文字で 結ぶので、片方だけだと 結べなくなる）。
 */
const RENAMES: readonly (readonly [string, string])[] = [
	["とうすこ", "ぷゆゆ"],
	["くさったパン", "チギュリパン"],
	["毒カボチャ", "まんぜう軍"],
	["錆び亡者", "風呂キャンセル界隈"],
	["ひとだま", "dat落ちの霊"],
	["迷いコウモリ", "深夜テンション"],
	["フナムシ", "バグ"],
	["さらいUFO", "拾い画UFO"],
	["キメラ", "自演くん"],
	["さまよう騎士", "鋼メンタル"],
	["雪だるま", "凍結アカ"],
	["石像", "置物"],
	["ばくだん", "炎上案件"],
	["ゴーレム", "ゴリラ"],
	["ばけ札", "釣り"],
	["影に", "透明あぼーんに"],
	["赤鬼", "顔真っ赤"],
	["凝視の目", "特定班"],
	["黒装束", "連投荒らし"],
	["闇堕ち兵", "粘着アンチ"],
	["過疎", "かまってちゃん"],
];
const renamed = <T extends { cause: string }>(r: T): T => {
	if (typeof r.cause !== "string") return r;
	const cause = RENAMES.reduce((c, [a, b]) => c.replaceAll(a, b), r.cause);
	return cause === r.cause ? r : { ...r, cause };
};

/** 記録（新しい順）。 */
export const loadRecords = (): RunRecord[] => {
	try {
		const raw = localStorage.getItem(RECORDS_KEY);
		if (!raw) return [];
		const list = JSON.parse(raw) as unknown;
		return Array.isArray(list) ? list.filter(isRecord).map(renamed) : [];
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
/** 記録に足す。同じ終わりが もう先頭にあれば 足さずに false。 */
export const addRecord = (r: RunRecord): boolean => {
	if (r.seed.startsWith(DEBUG_SEED)) return false;
	const list = loadRecords();
	const last = list[0];
	if (
		last &&
		last.seed === r.seed &&
		last.turn === r.turn &&
		last.kind === r.kind
	)
		return false;
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
	return true;
};

// ───────────────────────── どこまで開いたか ─────────────────────────
// トルネコ1と同じく、ちょっと → 本編 → もっと の順に開く（持ちこせるのは 知識と これだけ。強さは持ちこさない）。

export type ProgressNews = { dungeon: DungeonId; reason: "clear" | "relief" };

export type Progress = {
	/** もぐれるダンジョン。 */
	unlocked: DungeonId[];
	/** 持ち帰ったことのあるダンジョン。 */
	cleared: DungeonId[];
	/** 倒れた回数（B2 より先で すてた冒険も。ダンジョンごと。救いの条件に使う）。 */
	fails: Partial<Record<DungeonId, number>>;
	/** はじめの語り（intro）を見たダンジョン。 */
	intro: DungeonId[];
	/** 前に選んだダンジョン。 */
	last?: DungeonId;
	/** まだ知らせていない「開いた」（記録の札のあとに ひとこと）。 */
	news: ProgressNews[];
};

const isDungeon = (x: unknown): x is DungeonId =>
	typeof x === "string" && DUNGEON_IDS.includes(x as DungeonId);

/** どこまで開いたか。まだ無ければ、これまでの記録から決める（ダンジョンが1つだったころに遊んだ人は 本編も開いている）。 */
export const loadProgress = (): Progress => {
	try {
		const raw = localStorage.getItem(PROGRESS_KEY);
		if (raw) {
			const o = JSON.parse(raw) as Partial<Progress>;
			const list = (a: unknown) =>
				Array.isArray(a) ? a.filter(isDungeon) : [];
			const unlocked = list(o.unlocked);
			if (!unlocked.includes("shallow")) unlocked.unshift("shallow");
			return {
				unlocked,
				cleared: list(o.cleared),
				fails: o.fails && typeof o.fails === "object" ? o.fails : {},
				intro: list(o.intro),
				last: isDungeon(o.last) ? o.last : undefined,
				news: Array.isArray(o.news)
					? o.news.filter(
							(n) =>
								isDungeon(n?.dungeon) &&
								(n.reason === "clear" || n.reason === "relief"),
						)
					: [],
			};
		}
	} catch {
		// 読めなければ 記録から決めなおす
	}
	// 保存できない（プライベートモード等）ときは、この回のあいだ 覚えている分を使う
	if (progressMemo) return JSON.parse(JSON.stringify(progressMemo)) as Progress;
	// ここで決めた形を すぐ保存する（はじめて遊ぶ人の 最初の冒険の記録を「前の版で遊んだ」と取りちがえないように。
	// 村を開いたときに 必ず一度ここを通る）
	const st = runStats();
	const recs = loadRecords();
	// ダンジョンの無い記録は 前の版（本編だけ）のもの
	const dg = (r: RunRecord): DungeonId => r.dungeon ?? "main";
	const cleared = DUNGEON_IDS.filter((d) =>
		recs.some((r) => r.kind === "clear" && dg(r) === d),
	);
	// 記録が消えていれば 通算から（通算の clears は 前の版なら 本編のもの）
	if (!recs.length && st.clears > 0 && !cleared.includes("main"))
		cleared.push("main");
	const legacy = recs.length
		? recs.some((r) => r.dungeon === undefined)
		: st.runs > 0 || hasRunSave();
	const unlocked: DungeonId[] = ["shallow"];
	if (
		legacy ||
		cleared.includes("shallow") ||
		recs.some((r) => dg(r) !== "shallow")
	)
		unlocked.push("main");
	if (cleared.includes("main")) unlocked.push("deep");
	const fresh: Progress = {
		unlocked,
		cleared,
		fails: {},
		// 前の版の前口上は 本編のもの。ちょっと の語りは まだ見ていない
		intro: legacy ? ["main"] : [],
		last: legacy ? "main" : undefined,
		news: [],
	};
	saveProgress(fresh);
	return fresh;
};

/** この回のあいだの 進み具合の写し（保存できなくても、開いたダンジョンが また閉じないように）。 */
let progressMemo: Progress | null = null;

/** 試験用：この回の写しを忘れる（保存の場所を 入れかえたとき）。 */
export const forgetProgressMemo = (): void => {
	progressMemo = null;
};

export const saveProgress = (p: Progress): void => {
	progressMemo = JSON.parse(JSON.stringify(p)) as Progress;
	try {
		localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
	} catch {
		// 保存できなくても遊べる（この回は 写しで続ける。次に開いたとき 記録から決めなおす）
	}
};

/** 冒険が終わった（持ち帰った・倒れた・やめた）。次のダンジョンが開いたら 知らせを残す。 */
export const noteRunEnd = (
	dungeon: DungeonId,
	kind: "dead" | "clear" | "escape",
	seed?: string,
): void => {
	if (seed?.startsWith(DEBUG_SEED)) return;
	const p = loadProgress();
	const unlock = (id: DungeonId, reason: ProgressNews["reason"]) => {
		if (p.unlocked.includes(id)) return;
		p.unlocked.push(id);
		p.news.push({ dungeon: id, reason });
	};
	if (kind === "clear") {
		if (!p.cleared.includes(dungeon)) p.cleared.push(dungeon);
		for (const d of DUNGEON_IDS)
			if (DUNGEONS[d].unlockAfter === dungeon) unlock(d, "clear");
	} else if (kind === "dead") {
		const n = (p.fails[dungeon] ?? 0) + 1;
		p.fails[dungeon] = n;
		for (const d of DUNGEON_IDS) {
			const dg = DUNGEONS[d];
			if (dg.unlockAfter === dungeon && dg.reliefAfter && n >= dg.reliefAfter)
				unlock(d, "relief");
		}
	}
	saveProgress(p);
};

/**
 * 知らせを 1つ 見せおえた（村で 見せてから 消す。見せている 途中で 閉じたら 次に 開いたとき また 見せる）。
 */
export const doneProgressNews = (n: ProgressNews): void => {
	const p = loadProgress();
	const i = p.news.findIndex(
		(x) => x.dungeon === n.dungeon && x.reason === n.reason,
	);
	if (i < 0) return;
	p.news.splice(i, 1);
	saveProgress(p);
};

/** ダンジョンに もぐる（最後に もぐった所として 残す）。語りを見たなら それも覚える。 */
export const notePicked = (dungeon: DungeonId, sawIntro: boolean): void => {
	const p = loadProgress();
	p.last = dungeon;
	if (sawIntro && !p.intro.includes(dungeon)) p.intro.push(dungeon);
	saveProgress(p);
};

// ───────────────────────── 地上の町 ─────────────────────────
// 帰ってきた持ち物は いったん「おあずかり」（pending）に入れ、村に入ってから 倉庫へ・売る を決める
// （決める前に タブを閉じても、次に村に入ったとき 続きから決められるように）。

export type PendingReturn = {
	kind: "clear" | "escape";
	dungeon: DungeonId;
	seed: string;
	items: Item[];
};

export type Town = {
	/** 売上の合計。 */
	points: number;
	/** 町の段（0〜7。core/town.ts）。 */
	stage: number;
	/** 倉庫の道具。 */
	storage: Item[];
	/** まだ決めていない 持ち帰り。 */
	pending: PendingReturn | null;
	/** もう町へ帰ってきた冒険のシード（新しい順）。1つの冒険は 1回しか 帰れない（別のタブで 続けても）。 */
	returned: string[];
};

const RETURNED_KEEP = 50;

const isItem = (x: unknown): x is Item =>
	!!x &&
	typeof x === "object" &&
	typeof (x as Item).kind === "string" &&
	!!ITEMS[(x as Item).kind];

export const loadTown = (): Town => {
	try {
		const raw = localStorage.getItem(TOWN_KEY);
		if (raw) {
			const o = JSON.parse(raw) as Partial<Town>;
			const pend = o.pending;
			return {
				points: typeof o.points === "number" ? o.points : 0,
				stage: typeof o.stage === "number" ? o.stage : 0,
				storage: Array.isArray(o.storage) ? o.storage.filter(isItem) : [],
				pending:
					pend && isDungeon(pend.dungeon) && Array.isArray(pend.items)
						? { ...pend, items: pend.items.filter(isItem) }
						: null,
				returned: Array.isArray(o.returned)
					? o.returned.filter((x): x is string => typeof x === "string")
					: [],
			};
		}
	} catch {
		// 読めなければ はじめから
	}
	// まだ無ければ：ちょっと を持ち帰っていれば屋台、過去ログの底 を持ち帰っていれば いちばん上
	const p = loadProgress();
	return {
		points: 0,
		stage: p.cleared.includes("main")
			? 7
			: p.cleared.includes("shallow")
				? 1
				: 0,
		storage: [],
		pending: null,
		returned: [],
	};
};

export const saveTown = (t: Town): void => {
	try {
		localStorage.setItem(TOWN_KEY, JSON.stringify(t));
	} catch {
		// 保存できなくても遊べる
	}
};

const addPendingReturn = (s: RunState): void => {
	if (!s.end || s.end.kind === "dead") return;
	const t = loadTown();
	// もう帰ってきた冒険（同じ終わりの 保存し直し・別のタブで 続けた同じ冒険）は 二度 持ち帰らない
	if (t.returned.includes(s.seed)) return;
	// 前の おあずかりが残っていれば、先に ぜんぶ売ってしまう（取りこぼさない）
	if (t.pending) settleReturn(t, []);
	t.pending = {
		kind: s.end.kind,
		dungeon: s.dungeon,
		seed: s.seed,
		// 目的の品は 町に置く物ではないので 入れない
		items: s.player.items.filter((it) => defOf(it.kind).cat !== "goal"),
	};
	t.returned = [s.seed, ...t.returned].slice(0, RETURNED_KEEP);
	saveTown(t);
};

/**
 * おあずかりを 決める：stored（uid）を倉庫へ、残りを売って 売上に。段を上げる。
 * 倉庫に入れた道具は 正体がわかる（町で 見てもらう）。返り値は 売上と 段の前後。
 */
export const settleReturn = (
	t: Town,
	stored: readonly number[],
): { sold: number; from: number; to: number } => {
	const pend = t.pending;
	const from = t.stage;
	if (!pend) return { sold: 0, from, to: from };
	const cap = STORAGE_CAP[t.stage] ?? 0;
	let sold = 0;
	for (const it of pend.items) {
		if (
			pend.kind === "escape" &&
			stored.includes(it.uid) &&
			t.storage.length < cap
		)
			t.storage.push({ ...it, known: true });
		else sold += priceOf(it);
	}
	t.points += sold;
	const cleared = pend.kind === "clear";
	t.stage = nextStage(t.stage, t.points, {
		shallowCleared: cleared && pend.dungeon === "shallow",
		mainCleared: cleared && pend.dungeon === "main",
	});
	t.pending = null;
	saveTown(t);
	return { sold, from, to: t.stage };
};

/**
 * 倉庫から 持ちこむ道具を取り出す（取り出したら 倉庫から消える。倒れたら もどらない）。
 * 選んだときの 中身で さがす（別のタブで 倉庫が変わっていても、ちがう道具を 取らない。もう無ければ 取らない）。
 * uid は 冒険ごとの番号で 倉庫の中では かさなりうるので 使わない。
 */
export const takeFromStorage = (picked: readonly Item[]): Item[] => {
	const t = loadTown();
	const out: Item[] = [];
	for (const p of picked) {
		const key = JSON.stringify(p);
		const i = t.storage.findIndex((it) => JSON.stringify(it) === key);
		if (i >= 0) out.push(...t.storage.splice(i, 1));
	}
	saveTown(t);
	return out;
};

// ───────────────────────── リプレイ ─────────────────────────
// 終わった冒険の「シード＋コマンドの列」（core/replay.ts）。記録とはシードで結びつく。

export type SavedReplay = {
	seed: string;
	/** 倉庫から持ちこんだ道具（同じに始めるため）。 */
	carry?: Item[];
	/** どのダンジョンか（無ければ本編）。 */
	dungeon?: DungeonId;
	/** 終わった時刻（ms）。 */
	at: number;
	/** 遊んだ版（ゲームの中身の版。中断をはさんで版が変わったら 2つ以上）。 */
	builds: string[];
	/** コマンドの列。 */
	text: string;
	/** コマンドの数。 */
	n: number;
	kind: "dead" | "clear" | "escape";
	depth: number;
	turn: number;
	cause: string;
};

const isReplay = (r: unknown): r is SavedReplay => {
	if (!r || typeof r !== "object") return false;
	const o = r as Partial<SavedReplay>;
	return (
		typeof o.seed === "string" &&
		typeof o.text === "string" &&
		Array.isArray(o.builds) &&
		(o.kind === "dead" || o.kind === "clear" || o.kind === "escape")
	);
};

/** 残っているリプレイ（新しい順）。 */
export const loadReplays = (): SavedReplay[] => {
	try {
		const raw = localStorage.getItem(REPLAYS_KEY);
		if (!raw) return [];
		const list = JSON.parse(raw) as unknown;
		return Array.isArray(list) ? list.filter(isReplay).map(renamed) : [];
	} catch {
		return [];
	}
};

/** 持ちこんだ道具として 読めるか（人から もらった リプレイは 形を ぜんぶ 確かめる）。 */
const isCarryItem = (x: unknown): x is Item => {
	if (!isItem(x)) return false;
	const o = x as Item;
	return (
		typeof o.uid === "number" &&
		typeof o.plus === "number" &&
		typeof o.cursed === "boolean" &&
		typeof o.charges === "number" &&
		typeof o.known === "boolean" &&
		typeof o.count === "number" &&
		(o.rustproof === undefined || typeof o.rustproof === "boolean")
	);
};

/**
 * 人から もらった リプレイ（共有コードを 読んだもの）を 確かめて、使う ところだけ 取り出す。
 * 形が ちがえば null。
 */
export const toReplay = (o: unknown): SavedReplay | null => {
	if (!isReplay(o)) return null;
	const r = o as SavedReplay;
	const nums = [r.at, r.n, r.depth, r.turn];
	if (!nums.every((v) => typeof v === "number" && Number.isFinite(v)))
		return null;
	if (typeof r.cause !== "string") return null;
	if (!r.builds.every((b) => typeof b === "string")) return null;
	if (r.dungeon !== undefined && !DUNGEON_IDS.includes(r.dungeon)) return null;
	if (
		r.carry !== undefined &&
		!(Array.isArray(r.carry) && r.carry.every(isCarryItem))
	)
		return null;
	return renamed({
		seed: r.seed,
		...(r.carry?.length ? { carry: r.carry } : {}),
		...(r.dungeon ? { dungeon: r.dungeon } : {}),
		at: r.at,
		builds: r.builds,
		text: r.text,
		n: r.n,
		kind: r.kind,
		depth: r.depth,
		turn: r.turn,
		cause: r.cause,
	});
};

/**
 * そのリプレイが その記録のものか（シードに加えて 終わり方も同じ。
 * 2つのタブで同じ冒険を続けると、1つのシードに終わりが2つできることがある）。
 */
export const replayMatches = (p: SavedReplay, r: RunRecord): boolean =>
	p.seed === r.seed &&
	(p.dungeon ?? "main") === (r.dungeon ?? "main") &&
	p.kind === r.kind &&
	p.turn === r.turn &&
	p.depth === r.depth &&
	p.cause === r.cause;

/** 終わった冒険のリプレイを残す（記録していない冒険・開発用の冒険は残さない）。 */
const addReplay = (s: RunState): void => {
	if (s.seed.startsWith(DEBUG_SEED) || !s.end) return;
	if (typeof s.replay !== "string" || !s.replayN) return;
	// 同じ冒険の 同じ終わりだけ入れかえる（別のタブで続けた終わりは 別に残す）
	const end = s.end;
	const list = loadReplays().filter(
		(r) => !(r.seed === s.seed && r.kind === end.kind && r.turn === end.turn),
	);
	list.unshift({
		seed: s.seed,
		carry: s.carriedIn,
		dungeon: s.dungeon,
		at: Date.now(),
		builds: s.builds ?? [],
		text: s.replay,
		n: s.replayN,
		kind: s.end.kind,
		depth: s.end.depth,
		turn: s.end.turn,
		cause: s.end.cause,
	});
	if (list.length > REPLAYS_KEEP) list.length = REPLAYS_KEEP;
	// 入りきらなければ 古いものから捨てる（中断セーブ・記録の場所を取りすぎないように）
	while (list.length) {
		try {
			localStorage.setItem(REPLAYS_KEY, JSON.stringify(list));
			return;
		} catch {
			list.pop();
		}
	}
	// 新しいもの1つでも入らない：このリプレイは残せないが、前からのものは そのまま
};

// ───────────────────────── モンスター図鑑 ─────────────────────────
// 冒険をまたいで残るのは知識だけ。会った敵と、倒した数を覚えておく。

export type Book = { seen: string[]; kills: Record<string, number> };

export const loadBook = (): Book => {
	try {
		const raw = localStorage.getItem(BOOK_KEY);
		if (raw) {
			const b = JSON.parse(raw) as Partial<Book>;
			return {
				seen: Array.isArray(b.seen)
					? b.seen.filter((x) => typeof x === "string")
					: [],
				kills: b.kills && typeof b.kills === "object" ? b.kills : {},
			};
		}
	} catch {
		// 壊れていたら空から
	}
	return { seen: [], kills: {} };
};

const saveBook = (b: Book): void => {
	try {
		localStorage.setItem(BOOK_KEY, JSON.stringify(b));
	} catch {
		// 残せなくても遊べる
	}
};

/** はじめて会った敵を図鑑に載せる（もう載っていれば何もしない）。 */
export const markSeenMonster = (kind: string): void => {
	const b = loadBook();
	if (b.seen.includes(kind)) return;
	b.seen.push(kind);
	saveBook(b);
};

/** 冒険が終わったときに、倒した数を足す。 */
export const addBookKills = (kills: Record<string, number>): void => {
	const b = loadBook();
	for (const [k, n] of Object.entries(kills)) {
		b.kills[k] = (b.kills[k] ?? 0) + n;
		if (!b.seen.includes(k)) b.seen.push(k);
	}
	saveBook(b);
};

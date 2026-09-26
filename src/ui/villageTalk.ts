// 地上の ひとこと：タイトル（起動の札）の ひとこと、村で 仲間に 話しかけたときの ひとこと（1回の 帰りに
// 1人 1つの 新しい話と、そのあとの 決まった ひとこと）、レイの 帳簿、ダンジョンの ひとことの説明（口・立て札）。
// ひとことは 前の冒険の結果と 町の段から、仲間の セリフの たまり（data/story.ts・data/town.ts・data/quotes.ts）を引く。

import { DUNGEONS } from "../core/data/dungeons";
import { STAGE_POINTS, STORAGE_CAP, TOWN_STAGES } from "../core/town";
import type { DungeonId } from "../core/types";
import {
	pickQuote,
	type Quote,
	type QuoteContext,
	SPEAKERS,
	type Speaker,
} from "../data/quotes";
import {
	CLEAR,
	DUNGEON_NAMES,
	FIRST_SHALLOW,
	SHALLOW_DEATH,
} from "../data/story";
import {
	ESCAPE_QUOTES,
	TITLE_TOWN_QUOTES,
	VILLAGE_IDLE,
	VILLAGE_MSG,
} from "../data/town";
import { loadRecords, loadTown, runStats } from "../engine/save";

/**
 * ダンジョンの ひとことの説明（口・立て札の 2行目。階の数は 1行目の 名前の 横に 出す）。
 * 村の窓に 収まるよう 1行（全角22字まで）。
 */
export const DUNGEON_DESC: Record<DungeonId, string> = {
	shallow: "杖だけ　未識別。のろいも　祭りも　ない",
	main: "草・スレ・トリップ・杖が　未識別",
	deep: "特大おにぎり・◆腹いっぱい　なし。罠が　多い",
};

/** まだ開いていないダンジョンの 開き方。 */
export const lockedHint = (d: DungeonId): string => {
	const after = DUNGEONS[d].unlockAfter;
	if (!after) return "";
	const relief = DUNGEONS[d].reliefAfter;
	return `「${DUNGEON_NAMES[after].name}」を　持ち帰ると　開く${relief ? `（${relief}回　たおれても　開く）` : ""}`;
};

/** いちばん新しい記録から、ひとことの手がかりを作る。 */
const quoteContext = (): QuoteContext => {
	const last = loadRecords()[0];
	if (!last) return null;
	const st = runStats();
	return {
		kind: last.kind,
		// 持ち帰ったときの depth は地上の手前（1）なので、いちばん深い階を渡す
		depth: last.kind === "clear" ? last.maxDepth : last.depth,
		cause: last.cause,
		runs: st.runs,
		// 本編の たまり（「また 行ってきたんか」）なので、本編を 持ち帰った回数だけ（ちょっと・もっと は 数えない）
		clears: loadRecords().filter(
			(r) => r.kind === "clear" && (r.dungeon ?? "main") === "main",
		).length,
	};
};

/**
 * 起動の札の ひとこと。ちょっと・もっと の たまり（data/story.ts）を先に見て、
 * 無ければ 本編の たまり（data/quotes.ts の pickQuote）。
 */
export const titleQuote = (seed: number): Quote | null => {
	const last = loadRecords()[0];
	const pick = (pool: readonly Quote[], salt: number) =>
		pool.length ? pool[(seed * 31 + salt) % pool.length] : null;
	if (!last) return pick(FIRST_SHALLOW, 1);
	const d = last.dungeon ?? "main";
	if (last.kind === "escape") return pick(ESCAPE_QUOTES, 4);
	// ときどき 町の様子の ひとこと（屋台が出てから）
	const stage = loadTown().stage;
	if (stage >= 1 && seed % 3 === 0)
		return pick(TITLE_TOWN_QUOTES[stage] ?? [], 5);
	if (last.kind === "clear" && d !== "main") return pick(CLEAR[d], 2);
	if (last.kind === "dead" && d === "shallow" && seed % 2 === 0)
		return pick(SHALLOW_DEATH, 3);
	return pickQuote(quoteContext(), seed);
};

// ───────────────── 村で 話しかけたとき ─────────────────
// 1回の 帰りに 1人 1つだけ、前の冒険への 新しい ひとこと（頭の上に「！」）。聞いたら、次に 帰ってくるまで
// 短い 決まった ひとこと（その段の 町の様子。無い人は 役目の ひとこと）。
// 「帰り」は いちばん新しい 冒険の記録（終わった時刻）で 見分ける。聞いたかどうかは 村の 印として
// 別の 保存場所に 残す（中断セーブ・記録・町には 手を ふれない。保存できなくても この回は 覚えている）。

const HEARD_KEY = "kiriko-roguelike/village";

/** 仲間ごとに、聞いた ひとことの 帰り（記録の 終わった時刻。記録が 無ければ 0）。 */
type Heard = Partial<Record<Speaker, number>>;

/** 保存できないときの この回の 写し。 */
let heardMemo: Heard = {};

const loadHeard = (): Heard => {
	try {
		const raw = localStorage.getItem(HEARD_KEY);
		if (raw) {
			const o = JSON.parse(raw) as { heard?: unknown };
			const out: Heard = {};
			if (o?.heard && typeof o.heard === "object")
				for (const [k, v] of Object.entries(o.heard))
					if (k in SPEAKERS && typeof v === "number") out[k as Speaker] = v;
			return out;
		}
	} catch {
		// 読めなければ この回の 写し
	}
	return { ...heardMemo };
};

const saveHeard = (h: Heard): void => {
	heardMemo = { ...h };
	try {
		localStorage.setItem(HEARD_KEY, JSON.stringify({ heard: h }));
	} catch {
		// 保存できなくても 遊べる（この回は 写しで 覚えている）
	}
};

/** 試験用：この回の 写しを 忘れる。 */
export const forgetHeardMemo = (): void => {
	heardMemo = {};
};

/** いまの 帰り（いちばん新しい 冒険の記録の 終わった時刻。まだ無ければ 0）。 */
const returnAt = (): number => loadRecords()[0]?.at ?? 0;

/**
 * 前の冒険への その人の ひとこと（無ければ null）。帰りごとに 決まる（同じ帰りの あいだは 同じ）。
 * ちょっと・もっと の たまり（data/story.ts）と 帰還スレの たまりを 先に見て、無ければ 本編の たまり
 * （data/quotes.ts。死因・深さ）。
 */
const reaction = (who: Speaker): Quote | null => {
	const last = loadRecords()[0];
	const seed = (last?.at ?? 0) % 9973;
	const mine = (pool: readonly Quote[]) => {
		const p = pool.filter((x) => x.who === who);
		return p.length ? p[seed % p.length] : null;
	};
	if (!last) return mine(FIRST_SHALLOW);
	const d = last.dungeon ?? "main";
	if (last.kind === "escape") return mine(ESCAPE_QUOTES);
	if (last.kind === "clear" && d !== "main") return mine(CLEAR[d]);
	if (last.kind === "dead" && d === "shallow" && seed % 2 === 0)
		return mine(SHALLOW_DEATH) ?? pickQuote(quoteContext(), seed, who);
	return pickQuote(quoteContext(), seed, who);
};

/** その人の 決まった ひとこと（新しい話を 聞いたあと）。 */
const idleLine = (who: Speaker, o: { gate?: boolean }): string => {
	// 口の前で 見張っている間は 見張りの ひとこと
	if (who === "nanj" && o.gate) return VILLAGE_IDLE.gate;
	const stage = loadTown().stage;
	const town = (TITLE_TOWN_QUOTES[stage] ?? []).find((x) => x.who === who);
	if (town) return town.text;
	if (who === "teto" && (STORAGE_CAP[stage] ?? 0) > 0)
		return VILLAGE_IDLE.store;
	return VILLAGE_IDLE[who];
};

/** まだ 聞いていない 新しい ひとことが あるか（頭の上の「！」）。 */
export const hasNews = (who: Speaker): boolean =>
	loadHeard()[who] !== returnAt() && reaction(who) !== null;

/**
 * 話しかけたときの ひとこと。新しい話が あれば それ（聞いたと 覚える）、無ければ 決まった ひとこと。
 * gate は おんJ民が 本編の口の前で 見張っているとき。
 */
export const talkLine = (who: Speaker, o: { gate?: boolean } = {}): string => {
	const at = returnAt();
	const heard = loadHeard();
	if (heard[who] !== at) {
		const news = reaction(who);
		heard[who] = at;
		saveHeard(heard);
		if (news) return news.text;
	}
	return idleLine(who, o);
};

/** 文の {name} を 埋める。 */
export const fill = (
	text: string,
	vars: Record<string, string | number>,
): string =>
	text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

/** レイの 帳簿：売り上げの 合計と、次の 段までの のこり。 */
export const ledgerLine = (): string => {
	const t = loadTown();
	if (t.stage >= TOWN_STAGES - 1)
		return fill(VILLAGE_MSG.ledgerMax, { points: t.points });
	if (t.points <= 0) return VILLAGE_MSG.ledgerNone;
	const rest = (STAGE_POINTS[t.stage + 1] ?? 0) - t.points;
	// 足りていても 1回の 帰りで 上がるのは 1段まで（core/town.ts の nextStage）
	return rest > 0
		? fill(VILLAGE_MSG.ledger, { points: t.points, rest })
		: fill(VILLAGE_MSG.ledgerSoon, { points: t.points });
};

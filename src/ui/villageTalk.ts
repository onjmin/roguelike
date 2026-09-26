// 地上の ひとこと：タイトル（起動の札）の ひとこと、村で 仲間に 話しかけたときの ひとこと、
// ダンジョンの ひとことの説明（選ぶ窓・立て札）。
// ひとことは 前の冒険の結果と 町の段から、仲間の セリフの たまり（data/story.ts・data/town.ts・data/quotes.ts）を引く。

import { DUNGEONS } from "../core/data/dungeons";
import type { DungeonId } from "../core/types";
import {
	pickQuote,
	type Quote,
	type QuoteContext,
	type Speaker,
} from "../data/quotes";
import {
	CLEAR,
	DUNGEON_NAMES,
	FIRST_SHALLOW,
	SHALLOW_DEATH,
} from "../data/story";
import { ESCAPE_QUOTES, TITLE_TOWN_QUOTES } from "../data/town";
import { loadRecords, loadTown, runStats } from "../engine/save";

/** ダンジョンの ひとことの説明（選ぶ窓・立て札）。 */
export const DUNGEON_DESC: Record<DungeonId, string> = {
	shallow: "10階。杖だけ　名前が　わからない。のろいも　祭りも　ない",
	main: "20階。草・スレ・トリップ・杖の　名前が　わからない",
	deep: "30階。特大おにぎりと　◆腹いっぱいが　出ない。罠が　多い",
};

/** まだ開いていないダンジョンの 開き方。 */
export const lockedHint = (d: DungeonId): string => {
	const after = DUNGEONS[d].unlockAfter;
	if (!after) return "";
	const relief = DUNGEONS[d].reliefAfter;
	return `「${DUNGEON_NAMES[after].name}」を　持ち帰ると　開く${relief ? `（${relief}回　たおれても　開く）` : ""}`;
};

/** いちばん新しい記録から、タイトルの一言の手がかりを作る。 */
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
 * タイトルの ひとこと。ちょっと・もっと の たまり（data/story.ts）を先に見て、
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

/** 前の冒険への その人の ひとこと（無ければ null）。 */
const runBark = (who: Speaker, seed: number): Quote | null => {
	const last = loadRecords()[0];
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

/**
 * 村で 話しかけたときの ひとこと。n は その人に 話しかけた回数（0 から）。
 * 前の冒険への ひとことと、町の様子の ひとことを 交互に（その人の分が 無ければ もう片方）。
 */
export const barkFor = (who: Speaker, n: number): string | null => {
	const last = loadRecords()[0];
	// 同じ冒険のあいだは 同じ たまりから 回数ぶん ずらして引く
	const seed = ((last?.at ?? 0) % 9973) + n;
	const town = (TITLE_TOWN_QUOTES[loadTown().stage] ?? []).filter(
		(x) => x.who === who,
	);
	const townLine = town.length ? town[seed % town.length] : null;
	const runLine = runBark(who, seed);
	const first = n % 2 === 0 ? runLine : townLine;
	const second = n % 2 === 0 ? townLine : runLine;
	return (first ?? second)?.text ?? null;
};

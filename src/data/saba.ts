// ホシュクラ（data/village/saba.ts の 島）の 決まり：記録の 形・命名投票の 開票・鯖缶の お知らせ・水槽・夜・匠の マス。
// どれも 純粋な 関数（DOM・保存は ui/saba.ts）。村の 記録は kiriko-roguelike/saba だけで、強さ・道具・段には ふれない。

import type { TileDef } from "../engine/defs";
import type { Dir } from "../engine/types";
import type { Today } from "./calendar";
import { SABA_TEXT as X } from "./sabaText";
import { timeBand } from "./village/crowd";
import {
	type Cell,
	type VillageView,
	villagePalette,
	villagePlaces,
	villageRows,
} from "./village/map";

// ───────────────── 記録 ─────────────────

export type SabaVote = { pick: number; at: number; told: boolean };
export type SabaSave = {
	v: 1;
	/** 島で 数えた 最後の 帰り（ui/guests.ts の returnAt）。 */
	ret: number;
	/** 島に 来た 帰りの 数（はじめての 帰り = 1）。お知らせ・水槽・匠の 文が 進む。 */
	n: number;
	/** 湧き潰しの 小言の 回数と 最後に 言った 帰り。 */
	nag: number;
	nagAt: number;
	/** 段（"3"〜"7"）ごとの 命名投票（pick: 0〜3、入れて いない 段の 開票は -1）。 */
	votes: Record<string, SabaVote>;
	/** 102号室に 表札を 書いた。 */
	apart: boolean;
	/** ブラマイ（いちばん 多い ダイヤ・遊んだ 回数・ダイヤの 合計）。 */
	mine: { best: number; runs: number; total: number };
};

export const freshSaba = (): SabaSave => ({
	v: 1,
	ret: -1,
	n: 0,
	nag: 0,
	nagAt: -1,
	votes: {},
	apart: false,
	mine: { best: 0, runs: 0, total: 0 },
});

const int = (v: unknown, min = 0): number | null =>
	typeof v === "number" && Number.isInteger(v) && v >= min ? v : null;

/** 読んだ 記録を たしかめる（形が ちがう 所は はじめの 値）。 */
export const parseSaba = (raw: unknown): SabaSave => {
	const out = freshSaba();
	if (!raw || typeof raw !== "object") return out;
	const r = raw as Record<string, unknown>;
	if (r.v !== 1) return out;
	out.ret = int(r.ret, -1) ?? -1;
	out.n = int(r.n) ?? 0;
	out.nag = int(r.nag) ?? 0;
	out.nagAt = int(r.nagAt, -1) ?? -1;
	out.apart = r.apart === true;
	const m = r.mine as Record<string, unknown> | undefined;
	if (m && typeof m === "object")
		out.mine = {
			best: int(m.best) ?? 0,
			runs: int(m.runs) ?? 0,
			total: int(m.total) ?? 0,
		};
	const votes = r.votes as Record<string, unknown> | undefined;
	if (votes && typeof votes === "object")
		for (const [k, v] of Object.entries(votes)) {
			if (!(k in X.cands) || !v || typeof v !== "object") continue;
			const o = v as Record<string, unknown>;
			const pick = int(o.pick, -1);
			const at = int(o.at, -1);
			if (pick === null || pick > 3 || at === null) continue;
			out.votes[k] = { pick, at, told: o.told === true };
		}
	return out;
};

/** 島で はじめて ふれた 帰りなら 数える（数えたら true）。 */
export const countReturn = (s: SabaSave, at: number): boolean => {
	if (s.ret === at) return false;
	s.ret = at;
	s.n += 1;
	return true;
};

// ───────────────── 命名投票 ─────────────────

export type VoteStage = keyof typeof X.cands;
export const VOTE_STAGES = [3, 4, 5, 6, 7] as const;
/** 鯖民の 票（候補 0 と 1 が 同点。キリコの 1票で 決まる。ほかに 入れれば 決選で 0）。 */
export const VOTE_BASE = [5, 5, 3, 2] as const;

/** 開票（pick = キリコの 票 0〜3、入れて いなければ -1）。 */
export const voteResult = (
	pick: number,
): { win: number; other: number; runoff: boolean } => {
	const votes = VOTE_BASE.map((v, i) => v + (i === pick ? 1 : 0));
	const top = Math.max(...votes);
	const tops = votes.flatMap((v, i) => (v === top ? [i] : []));
	if (tops.length > 1) return { win: 0, other: tops[1] ?? 1, runoff: true };
	const win = tops[0] ?? 0;
	const other = votes
		.map((v, i) => ({ v, i }))
		.filter((o) => o.i !== win)
		.sort((a, b) => b.v - a.v || a.i - b.i)[0].i;
	return { win, other, runoff: false };
};

/** その 段の 開票が すんだか（段が 進んだ・入れた 帰りが すぎた）。 */
export const voteDecided = (
	s: SabaSave,
	st: number,
	cur: number,
	at: number,
): boolean => {
	if (st > cur) return false;
	if (st < cur) return true;
	const v = s.votes[String(st)];
	return !!v && v.pick >= 0 && v.at !== at;
};

/** いまの 初期スポの 名前（開票の すんだ いちばん 新しい 段）。 */
export const townName = (s: SabaSave, cur: number, at: number): string => {
	for (let st = Math.min(cur, 7); st >= 3; st--)
		if (voteDecided(s, st, cur, at)) {
			const r = voteResult(s.votes[String(st)]?.pick ?? -1);
			return X.cands[st as VoteStage][r.win];
		}
	return X.voteDefault;
};

/** まだ 知らせて いない 開票（いちばん 新しい 段。なければ null）。 */
export const pendingResult = (
	s: SabaSave,
	cur: number,
	at: number,
): number | null => {
	for (let st = Math.min(cur, 7); st >= 3; st--)
		if (voteDecided(s, st, cur, at) && !s.votes[String(st)]?.told) return st;
	return null;
};

// ───────────────── 夜・お知らせ・水槽 ─────────────────

/** 夜（20〜23時）と 夜中（0〜4時）。匠が 出て、ベッドで 寝られる。 */
export const isNight = (hour: number): boolean => {
	const b = timeBand(hour);
	return b === "night" || b === "late";
};

/** 土曜の 鯖イベ（週ごとに 1つ 進む）。 */
export const eventOf = (d: Today): string =>
	X.events[Math.floor(((d.m - 1) * 31 + d.d) / 7) % X.events.length];

/** 土曜の 鯖イベの 時刻（21時から その 日の うち）。 */
export const EVENT_HOUR = 21;

/** 鯖缶の 2窓目（土曜 21時〜 → 夜 → 朝やで → 土曜 → 日曜 → 帰りごとの お知らせ）。 */
export const noticeOf = (o: {
	n: number;
	stage: number;
	day: Today;
	hour: number;
	asa: boolean;
}): string => {
	if (o.day.w === 6 && o.hour >= EVENT_HOUR)
		return X.saturdayNight.replace("{event}", eventOf(o.day));
	if (isNight(o.hour)) return o.asa ? X.morning : X.night;
	if (o.day.w === 6) return X.saturday.replace("{event}", eventOf(o.day));
	if (o.day.w === 0) return X.sunday;
	const list = X.notices.filter((x) => o.stage >= x.from);
	return list[(((o.n - 1) % list.length) + list.length) % list.length].text;
};

/** 水槽の 2窓目（帰りごと：引っ越しの はり紙 → ぴかぴか → はり紙が ふえる → なし）。 */
export const tankLine = (n: number): string | null =>
	n % 4 === 2
		? X.tankNote
		: n % 4 === 3
			? X.tankClean
			: n % 4 === 0
				? X.tankGone
				: null;

// ───────────────── 匠の マス ─────────────────

/** 島（匠が 立てる 所）。豚レース場の 走路（12〜16, 47）は のぞく。 */
export const onIsle = (x: number, y: number): boolean =>
	x >= 0 && x <= 19 && y >= 41 && y <= 47 && !(y === 47 && x >= 12 && x <= 16);

const DV: Record<Dir, readonly [number, number]> = {
	up: [0, -1],
	right: [1, 0],
	down: [0, 1],
	left: [-1, 0],
};
const BACK: Record<Dir, Dir> = {
	up: "down",
	down: "up",
	left: "right",
	right: "left",
};
const SIDES: Record<Dir, readonly Dir[]> = {
	up: ["left", "right"],
	down: ["right", "left"],
	left: ["down", "up"],
	right: ["up", "down"],
};

/** 島の まわりの 地図（匠の マスを 何度も 引く ときは 1回だけ 作る）。 */
export type IsleMap = {
	rows: string[][];
	pal: Record<string, TileDef>;
	taken: Set<string>;
};
export const isleMap = (v: VillageView): IsleMap => ({
	rows: villageRows(v).map((r) => [...r]),
	pal: villagePalette(v),
	taken: new Set(villagePlaces(v).map((p) => `${p.x},${p.y}`)),
});

/** 夜の 匠が 出る マス：キリコの うしろ → 左右 → 前 の 順に、島の 中の 通れて だれも いない マス。 */
export const takumiCell = (
	m: IsleMap,
	x: number,
	y: number,
	dir: Dir,
): Cell | null => {
	for (const d of [BACK[dir], ...SIDES[dir], dir]) {
		const nx = x + DV[d][0];
		const ny = y + DV[d][1];
		if (free(m, nx, ny)) return [nx, ny];
	}
	return null;
};

const free = (m: IsleMap, x: number, y: number): boolean =>
	onIsle(x, y) &&
	!m.taken.has(`${x},${y}`) &&
	!!m.pal[m.rows[y]?.[x] ?? ""]?.passable;

/**
 * 匠が 去る 道（Story.move の 字。キリコ（kx, ky）から はなれる 向き → その 左右 の 順に 通れる 向きへ 2歩。
 * どこも ふさがって いれば ""＝その場で 消える）。
 */
export const takumiLeave = (
	m: IsleMap,
	kx: number,
	ky: number,
	tx: number,
	ty: number,
): string => {
	const away: Dir =
		tx > kx ? "right" : tx < kx ? "left" : ty > ky ? "down" : "up";
	const STEP: Record<Dir, string> = {
		up: "u",
		right: "r",
		down: "d",
		left: "l",
	};
	for (const d of [away, ...SIDES[away]]) {
		const nx = tx + DV[d][0];
		const ny = ty + DV[d][1];
		if (!free(m, nx, ny) || (nx === kx && ny === ky)) continue;
		return STEP[d].repeat(free(m, nx + DV[d][0], ny + DV[d][1]) ? 2 : 1);
	}
	return "";
};

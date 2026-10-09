// ランダム野球（おんJwiki pages/334。初出「!randomで野球やろうよ」2015）の 決まり。DOM も 保存も 使わない。
// 打者 1人ごとに !random（0〜100）を 1回。目の 意味は ルールA（簡易版）の まま（下の yakyuKind）。
// 村の 版：5回まで、同点なら 7回まで 延長、それでも 同点は 引き分け。キリコは 後攻（裏）の !random 係、
// 先攻の 目は 名無しが 振る。打順・名前は ナイター実況の 12球団（data/jikkyo/yakyuRoster.ts。ニックネームだけ）。
// 進み方（ルールA に 書いて いない 所は ここで 決めた）：
//   トリプルプレー … いつでも 3アウトで チェンジ（初出スレ >>1「【0】3者連続三振で攻守交代」と 同じ 意味）。
//   ダブルプレー   … ランナーが いて 2アウト 未満なら 打者と いちばん 後ろの ランナーが アウト。
//                    ほかは 1アウトで、見え方も ただの アウト（label "out"）。
//   暴投           … ランナーが 1つずつ 進む（3塁は 生還）。打者は そのまま もう 1度 振る（塁が 空なら label "wpEmpty"）。
//   四球           … 押し出しだけ 進む。
//   犠打           … 打者 アウト。3アウトで なく ランナーが いれば 全員 1つ 進む。いなければ ただの アウト（label "sacOut"）。
//   ヒット 1つ・ツーベース 2つ・スリーベース 3つ ランナーが 進み、打者は 1・2・3塁へ。ホームランは 全員 生還。
//   5回 以降の 裏に 後攻が 勝ち越せば サヨナラ。5回 以降の 表が 終わって 後攻が 勝っていれば 裏は ない。

import { JK_TEAM_IDS, type JkTeamId } from "../../core/jikkyoYakyu";
import { JK_TEAMS } from "../jikkyo/yakyuRoster";

export const YAKYU_INNINGS = 5;
export const YAKYU_MAX_INNINGS = 7;

export type YakyuKind =
	| "tp"
	| "hr"
	| "dp"
	| "out"
	| "wp"
	| "bb"
	| "sac"
	| "h1"
	| "h2"
	| "h3"
	| "fine";

/** 結果の 見え方（板の 文・スレの 1行・色・音。data/neta/text.ts の YAKYU.kinds・short の 鍵）。 */
export type YakyuLabel = YakyuKind | "wpEmpty" | "sacOut";

/** ルールA：【0】トリプルプレー【1】ホームラン【2~10】ダブルプレー【11~64】アウト【65~66】暴投【67~70】四球【71~74】犠打【75~88】ヒット【89~95】ツーベース【96~98】スリーベース【99】ファインプレー【100】ホームラン。 */
export const yakyuKind = (n: number): YakyuKind =>
	n <= 0
		? "tp"
		: n === 1 || n >= 100
			? "hr"
			: n <= 10
				? "dp"
				: n <= 64
					? "out"
					: n <= 66
						? "wp"
						: n <= 70
							? "bb"
							: n <= 74
								? "sac"
								: n <= 88
									? "h1"
									: n <= 95
										? "h2"
										: n <= 98
											? "h3"
											: "fine";

/** !random（0〜100）。乱数は 呼ぶ 側（板は Math.random、試験は 種つき）。 */
export const rollRandom = (rand: () => number): number =>
	Math.min(100, Math.floor(rand() * 101));

export type YakyuSide = "away" | "home";

export type YakyuState = {
	inning: number;
	/** true＝表（先攻 away が 打つ）。 */
	top: boolean;
	outs: number;
	/** 1塁・2塁・3塁。 */
	bases: [boolean, boolean, boolean];
	score: Record<YakyuSide, number>;
	/** 回ごとの 点（まだ 打って いない 回は undefined、裏の いらない 回も undefined＝x）。 */
	line: Record<YakyuSide, (number | undefined)[]>;
	/** 打順（0〜8）。 */
	batter: Record<YakyuSide, number>;
	over: YakyuSide | "draw" | null;
	sayonara: boolean;
};

export type YakyuStep = {
	n: number;
	kind: YakyuKind;
	/** 見え方（1アウトだけの ダブルプレーは out、塁が 空の 暴投は wpEmpty、ランナーの いない 犠打は sacOut）。 */
	label: YakyuLabel;
	side: YakyuSide;
	/** 振った 打者の 打順（0〜8）。 */
	order: number;
	runs: number;
	/** この 目で 取った アウトの 数。 */
	outs: number;
	/** この 目で 3アウト（攻守交代）。 */
	change: boolean;
};

export const yakyuStart = (): YakyuState => ({
	inning: 1,
	top: true,
	outs: 0,
	bases: [false, false, false],
	score: { away: 0, home: 0 },
	line: { away: [0], home: [] },
	batter: { away: 0, home: 0 },
	over: null,
	sayonara: false,
});

/** 1つ 振る（st を 書きかえる）。おわった 試合には 何も しない。 */
export const yakyuStep = (st: YakyuState, n: number): YakyuStep => {
	const side: YakyuSide = st.top ? "away" : "home";
	const kind = yakyuKind(n);
	const order = st.batter[side];
	const b = st.bases;
	const on = b.filter(Boolean).length;
	const outs0 = st.outs;
	let label: YakyuLabel = kind;
	let runs = 0;
	let next = true;
	/** ランナー 全員が m 個 進む（打者は 入らない）。 */
	const adv = (m: number) => {
		for (let i = 2; i >= 0; i--)
			if (b[i]) {
				b[i] = false;
				if (i + m >= 3) runs++;
				else b[i + m] = true;
			}
	};
	if (st.over)
		return {
			n,
			kind,
			label,
			side,
			order,
			runs: 0,
			outs: 0,
			change: false,
		};
	if (kind === "tp") {
		st.outs = 3;
		b.fill(false);
	} else if (kind === "dp") {
		if (on === 0 || st.outs === 2) {
			st.outs++;
			label = "out";
		} else {
			st.outs += 2;
			b[b.indexOf(true)] = false;
		}
	} else if (kind === "out" || kind === "fine") st.outs++;
	else if (kind === "wp") {
		if (on === 0) label = "wpEmpty";
		adv(1);
		next = false;
	} else if (kind === "bb") {
		if (b[0]) {
			if (b[1]) {
				if (b[2]) runs++;
				b[2] = true;
			}
			b[1] = true;
		}
		b[0] = true;
	} else if (kind === "sac") {
		st.outs++;
		if (on === 0) label = "sacOut";
		else if (st.outs < 3) adv(1);
	} else if (kind === "h1") {
		adv(1);
		b[0] = true;
	} else if (kind === "h2") {
		adv(2);
		b[1] = true;
	} else if (kind === "h3") {
		adv(3);
		b[2] = true;
	} else {
		adv(3);
		runs++;
	}
	const outs = st.outs - outs0;
	st.score[side] += runs;
	st.line[side][st.inning - 1] = (st.line[side][st.inning - 1] ?? 0) + runs;
	if (next) st.batter[side] = (order + 1) % 9;
	// サヨナラ（5回 以降の 裏に 勝ち越し）
	if (!st.top && st.inning >= YAKYU_INNINGS && st.score.home > st.score.away) {
		st.over = "home";
		st.sayonara = true;
		return { n, kind, label, side, order, runs, outs, change: false };
	}
	const change = st.outs >= 3;
	if (change) {
		st.outs = 0;
		b.fill(false);
		if (st.top) {
			if (st.inning >= YAKYU_INNINGS && st.score.home > st.score.away)
				st.over = "home";
			else {
				st.top = false;
				st.line.home[st.inning - 1] = 0;
			}
		} else if (st.inning >= YAKYU_INNINGS && st.score.home !== st.score.away)
			st.over = st.score.home > st.score.away ? "home" : "away";
		else if (st.inning >= YAKYU_MAX_INNINGS) st.over = "draw";
		else {
			st.inning++;
			st.top = true;
			st.line.away[st.inning - 1] = 0;
		}
	}
	return { n, kind, label, side, order, runs, outs, change };
};

/**
 * その 回の 打席が おわった 打者の 数（暴投は 打者が かわらないので 数えない。チェンジで 0）。
 * 9人 おわって まだ チェンジで なければ、次は 打者 一巡（板の 名無しが「打　者　一　巡　！」）。
 */
export const yakyuBatted = (pa: number, r: YakyuStep): number =>
	r.change ? 0 : r.kind === "wp" ? pa : pa + 1;
export const YAKYU_ROUND = 9;

/** 今日の カード（何試合目かで 決まる。後攻＝キリコが !random 係の 球団）。 */
export const yakyuCard = (
	games: number,
): { home: JkTeamId; away: JkTeamId } => {
	const k = JK_TEAM_IDS.length;
	const g = Math.max(0, Math.floor(games));
	const home = JK_TEAM_IDS[g % k];
	let away = JK_TEAM_IDS[(g * 7 + 5) % k];
	if (away === home) away = JK_TEAM_IDS[(g + 1) % k];
	return { home, away };
};

/** 球団の 1字（順位スレの 字）。 */
export const teamChar = (id: JkTeamId): string => JK_TEAMS[id].char;

/** 打順 order の 名前（ニックネームが なければ 名無し）。 */
export const batterName = (id: JkTeamId, order: number): string =>
	JK_TEAMS[id].lineup[order % 9]?.nick ?? "名無し";

/** 1試合 ぜんぶ（試験・釣り合いの 確かめ用）。振った 数も 返す。 */
export const yakyuSim = (
	rand: () => number,
	limit = 400,
): { st: YakyuState; rolls: number } => {
	const st = yakyuStart();
	let rolls = 0;
	while (!st.over && rolls < limit) {
		yakyuStep(st, rollRandom(rand));
		rolls++;
	}
	return { st, rolls };
};

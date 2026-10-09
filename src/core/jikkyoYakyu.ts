// ナイター実況の 試合（純粋。文は 持たない。文と 組み立ては data/jikkyo/yakyu.ts）。
// 7回表からの 中継を 1打席ずつ シムする。1〜6回は 先に だまって シムし、6回までの 点差が 4を こえたら
// 種に ':r1'〜':r5' を つけて 引きなおす。同じ 種なら 同じ 試合（core/rng の Rng だけ。冒険の 乱数には 触らない）。
// 球団（ロースター）は 引数で もらう（data/jikkyo/yakyuRoster.ts）。
// 名誉の 決まり：エラーは 名無しの 野手にだけ 起こし、どの 位置かは 決めない。死球・乱闘・ケガは 起こさない。
// yakyuSegs は 名目の 時間割の 骨（イントロ・練習・札・打席・窓・中継終了・試合終了・最後の 流れ）。

import { Rng } from "./rng";

export type JkTeamId =
	| "tora"
	| "g"
	| "ryu"
	| "koi"
	| "tsubame"
	| "hoshi"
	| "taka"
	| "kou"
	| "kamome"
	| "ori"
	| "neko"
	| "washi";

export const JK_TEAM_IDS: readonly JkTeamId[] = [
	"tora",
	"g",
	"ryu",
	"koi",
	"tsubame",
	"hoshi",
	"taka",
	"kou",
	"kamome",
	"ori",
	"neko",
	"washi",
];

export type JkTag =
	| "speed"
	| "glove"
	| "arm"
	| "eye"
	| "clutch"
	| "bunt"
	| "star"
	| "ph"
	| "defsub"
	| "stamina";
export type JkPos =
	| "捕"
	| "一"
	| "二"
	| "三"
	| "遊"
	| "左"
	| "中"
	| "右"
	| "DH";
export type JkRole = "ace" | "sp" | "su" | "rp" | "cl";
export type JkPitch =
	| "直球"
	| "カット"
	| "ツーシーム"
	| "フォーク"
	| "スプリット"
	| "チェンジアップ"
	| "スライダー"
	| "カーブ"
	| "ナックルカーブ"
	| "シンカー";

/** 打者（nick が null は 名無し。能力は 1〜5：ミート・パワー・走力・守備）。 */
export type JkBat = {
	readonly nick: string | null;
	readonly pos: JkPos | null;
	readonly bats: "左" | "右";
	readonly con: number;
	readonly pow: number;
	readonly spd: number;
	readonly def: number;
	readonly tags: readonly JkTag[];
	/** セの 投手の 打順（パの 本拠地では 名無しの DH）。 */
	readonly pitcherSlot?: boolean;
	/** 打席に 立つ 投手（セの 本拠地）。 */
	readonly pitcher?: boolean;
};

/** 投手（能力は 1〜5：球速・制球・球威）。 */
export type JkPit = {
	readonly nick: string | null;
	readonly role: JkRole;
	readonly throws: "左" | "右";
	readonly velo: number;
	readonly ctrl: number;
	readonly stuff: number;
	readonly pitch: JkPitch;
	readonly tags: readonly JkTag[];
};

export type JkColors = {
	/** ホームの 胴。 */
	readonly body: string;
	readonly cap: string;
	readonly trim: string;
	/** ビジターの 胴。 */
	readonly away: string;
	/** ファン（観客・スレの 札）。 */
	readonly fan: string;
	/** 見分けの ための ファン色の 控え。 */
	readonly alt: string;
};

export type JkTeam = {
	readonly id: JkTeamId;
	/** 球団の 1字（虎 兎 竜 鯉 燕 星 鷹 公 鴎 檻 猫 鷲）。 */
	readonly char: string;
	readonly league: "セ" | "パ";
	readonly dh: boolean;
	readonly colors: JkColors;
	readonly lineup: readonly JkBat[];
	readonly bench: readonly JkBat[];
	readonly pitchers: readonly JkPit[];
};

export type JkPlayKind =
	| "K"
	| "BB"
	| "walkin"
	| "HR"
	| "1B"
	| "2B"
	| "3B"
	| "E"
	| "GO"
	| "FO"
	| "dp"
	| "sacfly"
	| "fine"
	| "laser"
	| "request"
	| "steal"
	| "caught"
	| "closer"
	| "relief"
	| "reliefN"
	| "pinch"
	| "pinchN"
	| "defsub"
	| "chance"
	| "sansha"
	| "cm"
	| "lucky7"
	| "walkoff"
	| "gameset";

/** 見せ場の 種類（1つの 出来事に 当てはまる もの ぜんぶ）。suretate は 練習。 */
export type JkKind =
	| "suretate"
	| "HR"
	| "gyakuten"
	| "kachikoshi"
	| "douten"
	| "timely"
	| "run"
	| "walkoff"
	| "gameset"
	| "bigK"
	| "dp"
	| "E"
	| "fine"
	| "laser"
	| "steal"
	| "caught"
	| "closer"
	| "relief"
	| "pinch"
	| "defsub"
	| "walkin"
	| "request"
	| "chance"
	| "sansha"
	| "cm"
	| "lucky7"
	| "chukei"
	| "hit"
	| "out"
	| "walk";

export type JkBases = readonly [boolean, boolean, boolean];
export type JkDir = "レフト" | "センター" | "ライト";

/** 中継に 映る 出来事（7回表から）。score は 出来事の あと（[ビジター, ホーム]）。 */
export type JkPlay = {
	readonly inn: number;
	readonly top: boolean;
	readonly kind: JkPlayKind;
	/** 出来事の あとの アウト。 */
	readonly outs: number;
	readonly score: readonly [number, number];
	/** 打者・走者（steal）・代打（pinch）・次の 打者（chance）。名無しは null。 */
	readonly b?: string | null;
	/** 投手（closer・relief は 出てきた 投手）。 */
	readonly p?: string | null;
	/** 野手（fine・laser・defsub）・捕手（caught）。 */
	readonly f?: string | null;
	readonly pa?: boolean;
	readonly runs?: number;
	readonly lc?: "gyakuten" | "kachikoshi" | "douten" | null;
	/** 3〜5番の 名前の ある 打者・star の 打者・抑えとの 対決。 */
	readonly big?: boolean;
	readonly byCloser?: boolean;
	/** 次の 打者（名無しは null）。 */
	readonly next?: string | null;
	readonly rbi?: number;
	/** サヨナラの 打席（あとで 足す）。 */
	walkoff?: boolean;
	// TV の ための 中身
	readonly order?: number;
	readonly bats?: "左" | "右";
	readonly pitch?: JkPitch;
	readonly velo?: number;
	readonly look?: boolean;
	readonly dir?: JkDir;
	readonly pos?: JkPos;
	readonly before?: JkBases;
	readonly bases?: JkBases;
	readonly outsBefore?: number;
};

export type JkGame = {
	readonly seed: string;
	readonly home: JkTeamId;
	readonly away: JkTeamId;
	/** 中継の はじめの スレ番。 */
	readonly part: number;
	/** 6回までの イニングスコア（[ビジター, ホーム]）と 点。 */
	readonly pre: {
		readonly line: readonly [readonly number[], readonly number[]];
		readonly score: readonly [number, number];
	};
	readonly plays: readonly JkPlay[];
	/** 最後まで（12回まで だまって シムした 先も）の 点。 */
	readonly final: readonly [number, number];
	/** 最後の 回まで の イニングスコア。 */
	readonly line: readonly [readonly number[], readonly number[]];
	readonly winner: JkTeamId | null;
	/** 中継終了（10回以降で 名目 175秒・11回）。 */
	readonly cut: boolean;
	/** 今日の スター（勝った チームの 名前の ある 選手。いなければ null）。 */
	readonly star: string | null;
	readonly lastInn: number;
};

/** 名目の 時間（ms）。 */
export const JK_MS = {
	intro1: 1500,
	intro2: 1500,
	halfCard: 1500,
	change: 800,
	pa: 1800,
	inPlay: 600,
	fast: 1100,
	card: 1800,
	cm: 2500,
	lucky7: 1500,
	walkoff: 1500,
	chukei: 2500,
	gameset: 3000,
	steal: 1200,
	flood: 2000,
	window: 4000,
	reveal: 800,
} as const;

/** 見せ場を 出す 決まり。 */
export const JK_SHOW = {
	MIN_GAP: 2500,
	GAP: 10000,
	HALF_CAP: 2,
	MAX_CHANCE: 2,
	CUT_MS: 175000,
	HEAT_GAIN: 1.6,
	HEAT_HALF: 4000,
} as const;

export const JK_PRIORITY: Readonly<Record<JkKind, number>> = {
	suretate: 0,
	walkoff: 100,
	chukei: 99,
	gameset: 95,
	gyakuten: 90,
	kachikoshi: 85,
	douten: 80,
	HR: 75,
	closer: 70,
	laser: 65,
	fine: 60,
	dp: 55,
	timely: 50,
	E: 50,
	run: 49,
	pinch: 48,
	walkin: 46,
	bigK: 44,
	steal: 40,
	caught: 38,
	request: 36,
	defsub: 34,
	relief: 30,
	chance: 28,
	cm: 26,
	lucky7: 24,
	sansha: 20,
	hit: 12,
	walk: 11,
	out: 10,
};

/** 必ず 見せ場に する 種類。 */
export const JK_MUST: ReadonlySet<JkKind> = new Set([
	"walkoff",
	"gameset",
	"chukei",
	"gyakuten",
	"kachikoshi",
	"douten",
	"HR",
	"closer",
	"cm",
	"lucky7",
]);
/** ふつうの 打席（間が あいた ときだけ 見せ場に）。 */
export const JK_GENERIC: ReadonlySet<JkKind> = new Set(["hit", "walk", "out"]);

/** 熱の 足し量。 */
export const JK_HEAT: Readonly<Record<JkKind | "minor", number>> = {
	suretate: 0.2,
	walkoff: 2.2,
	gyakuten: 1.4,
	gameset: 1.2,
	kachikoshi: 1.1,
	douten: 1.0,
	HR: 1.0,
	chukei: 1.0,
	laser: 0.7,
	timely: 0.7,
	run: 0.6,
	closer: 0.6,
	E: 0.6,
	request: 0.6,
	fine: 0.5,
	dp: 0.5,
	pinch: 0.5,
	walkin: 0.5,
	bigK: 0.5,
	steal: 0.4,
	caught: 0.4,
	chance: 0.4,
	lucky7: 0.3,
	defsub: 0.2,
	relief: 0.2,
	sansha: 0.2,
	cm: 0.1,
	hit: 0.15,
	walk: 0.1,
	out: 0.08,
	minor: 0.08,
};

// ───────────────── 1打席 ─────────────────

type Outcome = "K" | "BB" | "HR" | "1B" | "2B" | "3B" | "E" | "FO" | "GO";

const d = (x: number | undefined) => (x ?? 3) - 3;

/** 1打席の 結果（死球は なし。前の .008 は 四球に 足した）。 */
const paOutcome = (r: Rng, b: JkBat, p: JkPit): Outcome => {
	const eye = b.tags.includes("eye") ? 1 : 0;
	const ps = [
		["K", 0.2 + 0.03 * d(p.stuff) + 0.02 * d(p.velo) - 0.03 * d(b.con)],
		["BB", 0.088 - 0.02 * d(p.ctrl) + 0.015 * eye],
		["HR", 0.028 + 0.012 * d(b.pow) - 0.005 * d(p.stuff)],
		["1B", 0.16 + 0.022 * d(b.con) - 0.01 * d(p.stuff) + 0.004 * d(b.spd)],
		["2B", 0.045 + 0.008 * d(b.pow)],
		["3B", 0.004 + 0.003 * d(b.spd)],
	] as const;
	let x = r.float();
	for (const [k, v] of ps) {
		const q = Math.max(0.002, v);
		if (x < q) return k;
		x -= q;
	}
	if (x < 0.012) return "E";
	return r.float() < 0.5 + 0.05 * d(b.pow) ? "FO" : "GO";
};

// ───────────────── 試合 ─────────────────

const NANASHI_BAT: JkBat = {
	nick: null,
	pos: null,
	bats: "右",
	con: 3,
	pow: 2,
	spd: 3,
	def: 3,
	tags: [],
};
const NANASHI_PIT: JkPit = {
	nick: null,
	role: "rp",
	throws: "右",
	velo: 3,
	ctrl: 3,
	stuff: 3,
	pitch: "直球",
	tags: [],
};
const PITCHER_BAT: JkBat = {
	nick: null,
	pos: null,
	bats: "右",
	con: 1,
	pow: 1,
	spd: 2,
	def: 3,
	tags: [],
	pitcher: true,
};

const DIRS: readonly JkDir[] = ["レフト", "センター", "ライト"];
const GO_POS: readonly JkPos[] = ["二", "遊", "三", "一"];
const FO_POS: readonly JkPos[] = ["左", "中", "右", "遊", "二"];

type Side = {
	t: JkTeam;
	lineup: JkBat[];
	next: number;
	pitcher: JkPit;
	starter: JkPit;
	runsAllowed: number;
	used: Set<string>;
	bench: JkBat[];
	/** 先発が 降りた 回（降りて いなければ 99）。 */
	starterOut: number;
};

type Runner = JkBat | null;

const simOnce = (
	seed: string,
	homeId: JkTeamId,
	awayId: JkTeamId,
	teams: Readonly<Record<JkTeamId, JkTeam>>,
) => {
	const r = Rng.fromSeed(seed);
	const home = teams[homeId];
	const away = teams[awayId];
	const seHome = !home.dh;
	const lineupOf = (t: JkTeam): JkBat[] =>
		t.lineup.map((s, i) => {
			if (s.nick) return { ...s };
			const pitcherHere = seHome ? !!s.pitcherSlot || (t.dh && i === 8) : false;
			return pitcherHere ? { ...PITCHER_BAT } : { ...NANASHI_BAT };
		});
	const starterOf = (t: JkTeam): JkPit => {
		const sps = t.pitchers.filter((p) => p.role === "ace" || p.role === "sp");
		const ace = sps.find((p) => p.role === "ace") ?? sps[0] ?? NANASHI_PIT;
		return r.float() < 0.5 ? ace : (sps[r.int(sps.length)] ?? ace);
	};
	const side = (t: JkTeam): Side => {
		const p = starterOf(t);
		return {
			t,
			lineup: lineupOf(t),
			next: 0,
			pitcher: p,
			starter: p,
			runsAllowed: 0,
			used: new Set(),
			bench: [...t.bench],
			starterOut: 99,
		};
	};
	const S: [Side, Side] = [side(away), side(home)];
	const score: [number, number] = [0, 0];
	const line: [number[], number[]] = [[], []];
	const plays: JkPlay[] = [];
	const stars: {
		kind: "walkoff" | "lead" | "hr" | "save";
		team: 0 | 1;
		nick: string;
	}[] = [];

	const half = (inn: number, top: boolean, broadcast: boolean) => {
		const bat = S[top ? 0 : 1];
		const fld = S[top ? 1 : 0];
		const bi: 0 | 1 = top ? 0 : 1;
		let outs = 0;
		const bases: [Runner, Runner, Runner] = [null, null, null];
		let paCount = 0;
		let onBase = 0;
		const startRuns = score[bi];
		const flags = (): JkBases => [!!bases[0], !!bases[1], !!bases[2]];
		const ev = (kind: JkPlayKind, extra: Partial<JkPlay> = {}) => {
			if (broadcast)
				plays.push({
					inn,
					top,
					kind,
					outs,
					score: [score[0], score[1]],
					bases: flags(),
					...extra,
				});
		};
		if (inn >= 7) {
			const lead = score[1 - bi] - score[bi];
			const cl = fld.t.pitchers.find((p) => p.role === "cl");
			const su = fld.t.pitchers.find((p) => p.role === "su" || p.role === "rp");
			const cur = fld.pitcher;
			let want = cur;
			const starterOk = fld.runsAllowed <= 2;
			if (inn === 7)
				want =
					starterOk && r.float() < 0.6
						? cur
						: su && r.float() < 0.5
							? su
							: NANASHI_PIT;
			else if (inn === 8)
				want =
					cur.tags.includes("stamina") && starterOk
						? cur
						: su?.nick && !fld.used.has(su.nick)
							? su
							: NANASHI_PIT;
			else {
				const save = lead >= 1 && lead <= 3;
				if ((save || lead === 0) && cl?.nick && !fld.used.has(cl.nick))
					want = cl;
				else if (cur.tags.includes("stamina") && starterOk && lead > 0)
					want = cur;
				else want = cur.role === "cl" && inn === 9 ? cur : NANASHI_PIT;
			}
			if (want !== cur) {
				fld.pitcher = want;
				if (cur === fld.starter && fld.starterOut === 99) fld.starterOut = inn;
				if (want.nick) fld.used.add(want.nick);
				ev(want.role === "cl" ? "closer" : want.nick ? "relief" : "reliefN", {
					p: want.nick,
				});
			}
			const ds = fld.bench.find((b) => b.tags.includes("defsub"));
			if (inn >= 9 && ds && lead >= 1 && lead <= 3) {
				fld.bench = fld.bench.filter((b) => b !== ds);
				ev("defsub", { f: ds.nick });
			}
		}
		while (outs < 3) {
			const slotIdx = bat.next % 9;
			let b = bat.lineup[slotIdx];
			if (
				inn >= 8 &&
				Math.abs(score[0] - score[1]) <= 2 &&
				(!b.nick || b.pitcher)
			) {
				const ph = bat.bench.find((x) => x.tags.includes("ph"));
				if (ph && (b.pitcher || r.float() < 0.5)) {
					bat.bench = bat.bench.filter((x) => x !== ph);
					bat.lineup[slotIdx] = { ...ph };
					b = bat.lineup[slotIdx];
					ev("pinch", { b: ph.nick, order: slotIdx + 1 });
				} else if (b.pitcher) {
					bat.lineup[slotIdx] = { ...NANASHI_BAT };
					b = bat.lineup[slotIdx];
					ev("pinchN", { order: slotIdx + 1 });
				}
			}
			bat.next++;
			paCount++;
			if (
				inn >= 8 &&
				(bases[1] || bases[2]) &&
				outs < 2 &&
				Math.abs(score[0] - score[1]) <= 2
			)
				ev("chance", { b: b.nick, order: slotIdx + 1 });
			const lead1 = bases[0];
			if (lead1 && !bases[1] && outs < 2 && lead1.spd >= 4) {
				if (r.float() < (lead1.spd >= 5 ? 0.3 : 0.12)) {
					const c = fld.lineup.find((x) => x.pos === "捕");
					const arm = !!c?.tags.includes("arm") || (c?.def ?? 3) >= 5;
					const before = flags();
					if (r.float() < (lead1.spd >= 5 ? 0.8 : 0.68) - (arm ? 0.1 : 0)) {
						bases[1] = lead1;
						bases[0] = null;
						ev("steal", { b: lead1.nick, before, outsBefore: outs });
					} else {
						bases[0] = null;
						outs++;
						ev("caught", { f: c?.nick ?? null, before, outsBefore: outs - 1 });
						if (outs >= 3) break;
					}
				}
			}
			const p = fld.pitcher;
			const o = paOutcome(r, b, p);
			const before = score[bi];
			const basesBefore = flags();
			const outsBefore = outs;
			const scoreRun = (n: number) => {
				score[bi] += n;
				fld.runsAllowed += n;
			};
			const adv = (n: number, batter: JkBat | null): number => {
				let runs = 0;
				for (let i = 2; i >= 0; i--) {
					const runner = bases[i];
					if (!runner) continue;
					const to =
						i +
						n +
						(n === 1 && i === 1 && r.float() < 0.55 + 0.05 * d(runner.spd)
							? 1
							: 0) +
						(n === 2 && i === 0 && r.float() < 0.4 ? 1 : 0);
					if (to >= 3) runs++;
					else bases[to] = runner;
					bases[i] = null;
				}
				if (batter && n < 4) bases[n - 1] = batter;
				return runs;
			};
			let kind: JkPlayKind = o;
			const extra: {
				b: string | null;
				p: string | null;
				pa: true;
				f?: string | null;
				rbi?: number;
				dir?: JkDir;
				pos?: JkPos;
				look?: boolean;
			} = { b: b.nick, p: p.nick, pa: true };
			if (o === "K") {
				outs++;
				extra.look = r.float() < 0.3;
			} else if (o === "BB") {
				if (bases[0] && bases[1] && bases[2]) {
					scoreRun(1);
					kind = "walkin";
				}
				if (bases[0]) {
					if (bases[1] && !bases[2]) bases[2] = bases[1];
					bases[1] = bases[0];
				}
				bases[0] = b;
				onBase++;
			} else if (o === "HR") {
				const n = 1 + bases.filter(Boolean).length;
				bases[0] = bases[1] = bases[2] = null;
				scoreRun(n);
				extra.rbi = n;
				extra.dir = DIRS[r.int(3)];
				onBase++;
			} else if (o === "1B" || o === "2B" || o === "3B" || o === "E") {
				const n = o === "2B" ? 2 : o === "3B" ? 3 : 1;
				extra.dir = DIRS[r.int(3)];
				const of = fld.lineup.filter(
					(x) =>
						(x.pos === "左" || x.pos === "中" || x.pos === "右") &&
						x.tags.includes("arm"),
				);
				if (o === "1B" && bases[1] && of.length && r.float() < 0.3) {
					outs++;
					bases[1] = null;
					scoreRun(adv(1, b));
					kind = "laser";
					extra.f = of[0].nick;
					extra.pos = of[0].pos ?? undefined;
				} else scoreRun(adv(n, b));
				onBase++;
			} else if (o === "GO") {
				extra.pos = GO_POS[r.int(GO_POS.length)];
				if (bases[0] && outs < 2 && r.float() < 0.35 - 0.05 * d(b.spd)) {
					outs += 2;
					bases[0] = null;
					kind = "dp";
					if (outs < 3) scoreRun(adv(1, null));
				} else {
					outs++;
					if (outs < 3 && r.float() < 0.5) scoreRun(adv(1, null));
				}
			} else if (o === "FO") {
				extra.pos = FO_POS[r.int(FO_POS.length)];
				outs++;
				if (outs < 3 && bases[2] && r.float() < 0.5) {
					bases[2] = null;
					scoreRun(1);
					kind = "sacfly";
				}
			}
			if ((o === "GO" || o === "FO") && kind !== "dp") {
				const g = fld.lineup.filter(
					(x) => x.nick && (x.tags.includes("glove") || x.def >= 5),
				);
				if (g.length && r.float() < 0.12) {
					kind = "fine";
					const who = g[r.int(g.length)];
					extra.f = who.nick;
					extra.pos = who.pos ?? extra.pos;
				} else if (r.float() < 0.015) {
					kind = "request";
					outs--;
					bases[0] = bases[0] ?? b;
				}
			}
			const diffB = score[bi] - score[1 - bi];
			const diffA = before - score[1 - bi];
			let lc: JkPlay["lc"] = null;
			if (score[bi] > before) {
				if (diffA < 0 && diffB > 0) lc = "gyakuten";
				else if (diffA === 0 && diffB > 0) lc = "kachikoshi";
				else if (diffA < 0 && diffB === 0) lc = "douten";
			}
			if (broadcast && (lc === "gyakuten" || lc === "kachikoshi") && b.nick)
				stars.push({ kind: "lead", team: bi, nick: b.nick });
			if (broadcast && o === "HR" && b.nick)
				stars.push({ kind: "hr", team: bi, nick: b.nick });
			const nxt = bat.lineup[bat.next % 9];
			ev(kind, {
				...extra,
				runs: score[bi] - before,
				lc,
				big:
					([3, 4, 5].includes(slotIdx + 1) && !!b.nick) ||
					b.tags.includes("star") ||
					p.role === "cl",
				byCloser: p.role === "cl",
				next: nxt?.nick ?? null,
				order: slotIdx + 1,
				bats: b.bats,
				pitch: p.pitch,
				velo: p.velo,
				before: basesBefore,
				outsBefore,
			});
			if (!top && inn >= 9 && score[1] > score[0]) {
				if (b.nick) stars.push({ kind: "walkoff", team: 1, nick: b.nick });
				ev("walkoff", { b: b.nick, runs: 0 });
				line[bi].push(score[bi] - startRuns);
				return { walkoff: true };
			}
		}
		line[bi].push(score[bi] - startRuns);
		if (broadcast && paCount === 3 && onBase === 0) ev("sansha");
		return { walkoff: false };
	};
	for (let inn = 1; inn <= 6; inn++) {
		half(inn, true, false);
		half(inn, false, false);
	}
	const pre: [number, number] = [score[0], score[1]];
	const preLine: [number[], number[]] = [[...line[0]], [...line[1]]];
	let lastInn = 6;
	for (let inn = 7; inn <= 12; inn++) {
		lastInn = inn;
		if (inn === 9)
			plays.push({
				inn,
				top: true,
				kind: "cm",
				outs: 0,
				score: [score[0], score[1]],
			});
		half(inn, true, true);
		if (inn >= 9 && score[1] > score[0]) break;
		if (inn === 7)
			plays.push({
				inn,
				top: false,
				kind: "lucky7",
				outs: 0,
				score: [score[0], score[1]],
			});
		const res = half(inn, false, true);
		if (res.walkoff) break;
		if (inn >= 9 && score[0] !== score[1]) break;
	}
	plays.push({
		inn: lastInn,
		top: false,
		kind: "gameset",
		outs: 3,
		score: [score[0], score[1]],
	});
	// セーブ・7回以上の 先発（勝った 側）
	const win: 0 | 1 | null =
		score[0] > score[1] ? 0 : score[1] > score[0] ? 1 : null;
	if (win !== null) {
		const s = S[win];
		if (s.pitcher.role === "cl" && s.pitcher.nick)
			stars.push({ kind: "save", team: win, nick: s.pitcher.nick });
	}
	return { pre, preLine, plays, score, line, lastInn, S, stars, win, r };
};

/** 今日の スター：サヨナラ > 最後の 勝ち越し・逆転 > 本塁打 > セーブ > 7回以上の 先発（勝った 側の 名前の ある 選手）。 */
const starFrom = (
	stars: {
		kind: "walkoff" | "lead" | "hr" | "save";
		team: 0 | 1;
		nick: string;
	}[],
	win: 0 | 1 | null,
	starter: JkPit | null,
	starterOut: number,
): string | null => {
	if (win === null) return null;
	const mine = stars.filter((s) => s.team === win);
	for (const k of ["walkoff", "lead", "hr", "save"] as const) {
		const s = mine.filter((x) => x.kind === k).at(-1);
		if (s) return s.nick;
	}
	if (starter?.nick && starterOut >= 8) return starter.nick;
	return null;
};

/** 同じ リーグどうし 85%・交流戦 15%。ホームと ビジターも ランダム。 */
export const pickCard = (
	rng: Rng,
	teams: Readonly<Record<JkTeamId, JkTeam>>,
): { home: JkTeamId; away: JkTeamId } => {
	const ids = JK_TEAM_IDS.filter((id) => teams[id]);
	const home = ids[rng.int(ids.length)];
	const inter = rng.float() < 0.15;
	const pool = ids.filter(
		(id) => id !== home && (inter || teams[id].league === teams[home].league),
	);
	const away = pool[rng.int(pool.length)];
	return { home, away };
};

/** 試合（同じ 種なら 同じ 試合）。6回までの 点差が 4を こえたら 種に ':r1'〜':r5' を つけて 引きなおす。 */
export const simulateGame = (
	seed: string,
	home: JkTeamId,
	away: JkTeamId,
	teams: Readonly<Record<JkTeamId, JkTeam>>,
): JkGame => {
	let used = seed;
	let g = simOnce(seed, home, away, teams);
	for (let k = 1; k <= 5 && Math.abs(g.pre[0] - g.pre[1]) > 4; k++) {
		used = `${seed}:r${k}`;
		g = simOnce(used, home, away, teams);
	}
	const winSide = g.win;
	const ws = winSide === null ? null : g.S[winSide];
	const star = starFrom(
		g.stars,
		winSide,
		ws?.starter ?? null,
		ws?.starterOut ?? 0,
	);
	const base = {
		seed: used,
		home,
		away,
		part: 8 + g.r.int(23),
		pre: { line: g.preLine, score: g.pre },
		plays: g.plays,
		final: g.score,
		line: g.line,
		winner: winSide === null ? null : winSide === 0 ? away : home,
		star,
		lastInn: g.lastInn,
		cut: false,
	} satisfies JkGame;
	return { ...base, cut: yakyuSegs(base).cut };
};

// ───────────────── 見せ場の 種類 ─────────────────

const SOLO: ReadonlySet<JkPlayKind> = new Set([
	"gameset",
	"cm",
	"lucky7",
	"sansha",
	"closer",
	"relief",
	"pinch",
	"defsub",
	"chance",
	"steal",
	"caught",
]);

/** 1つの 出来事に 当てはまる 見せ場の 種類 ぜんぶ。 */
export const kindsOf = (e: JkPlay): Set<JkKind> => {
	const k = new Set<JkKind>();
	if (SOLO.has(e.kind)) {
		k.add(e.kind as JkKind);
		return k;
	}
	if (e.kind === "walkoff" || !e.pa) return k;
	const hit =
		e.kind === "1B" || e.kind === "2B" || e.kind === "3B" || e.kind === "HR";
	if (hit) k.add("hit");
	if (e.kind === "HR") k.add("HR");
	if (e.kind === "K") {
		k.add("out");
		if (e.big) k.add("bigK");
	}
	if (["GO", "FO", "sacfly", "dp", "fine", "laser"].includes(e.kind))
		k.add("out");
	if (["dp", "fine", "laser", "E", "request", "walkin"].includes(e.kind))
		k.add(e.kind as JkKind);
	if (e.kind === "BB") k.add("walk");
	if ((e.runs ?? 0) > 0) {
		if (hit && e.kind !== "HR" && !e.lc) k.add("timely");
		if (!hit) k.add("run");
	}
	if (e.lc) k.add(e.lc);
	if (e.walkoff) k.add("walkoff");
	return k;
};

/** いちばんの 種類（テロップ・熱・SE）。 */
export const topOf = (ks: Iterable<JkKind>): JkKind | null => {
	let best: JkKind | null = null;
	for (const k of ks)
		if (best === null || JK_PRIORITY[k] > JK_PRIORITY[best]) best = k;
	return best;
};

// ───────────────── 時間割の 骨 ─────────────────

export type YSegKind =
	| "intro"
	| "practice"
	| "start"
	| "half"
	| "change"
	| "play"
	| "window"
	| "chukei"
	| "joy"
	| "flood";

export type YPrompt = {
	readonly kinds: readonly JkKind[];
	readonly top: JkKind;
	readonly practice?: boolean;
	readonly play?: JkPlay;
};

export type YSeg = {
	readonly start: number;
	readonly dur: number;
	heat: number;
	readonly kind: YSegKind;
	readonly play?: JkPlay;
	readonly half?: { readonly inn: number; readonly top: boolean };
	prompt?: YPrompt;
};

/**
 * 名目の 時間割の 骨。イントロ 1500 → 練習の 窓（>>1 乙）→ 1500 → 半イニングごとの 札・打席・見せ場の 窓
 * （4000＋800）→ 中継終了 → 試合終了 → 最後の 流れ 2000。P は 練習を のぞく 窓の 数。
 */
export const yakyuSegs = (
	g: Pick<JkGame, "plays">,
): { segs: YSeg[]; total: number; P: number; cut: boolean } => {
	const segs: YSeg[] = [];
	let t = 0;
	const push = (
		kind: YSegKind,
		dur: number,
		heat: number,
		extra: Partial<YSeg> = {},
	): YSeg => {
		const s: YSeg = { start: t, dur, heat, kind, ...extra };
		segs.push(s);
		t += dur;
		return s;
	};
	const win = (heat: number, prompt: YPrompt) =>
		push("window", JK_MS.window + JK_MS.reveal, heat, {
			prompt,
			play: prompt.play,
		});
	push("intro", JK_MS.intro1, 0.1);
	win(JK_HEAT.suretate, {
		kinds: ["suretate"],
		top: "suretate",
		practice: true,
	});
	push("start", JK_MS.intro2, 0);
	let lastClose = t;
	let half: string | null = null;
	let perHalf = 0;
	let paInHalf = 0;
	let chances = 0;
	let sansha = 0;
	let cut = false;
	const plays = g.plays.map((p) => ({ ...p }));
	for (const e of plays) {
		if (cut && e.kind !== "gameset") continue;
		const key = `${e.inn}${e.top}`;
		if (e.kind !== "gameset" && e.kind !== "cm" && key !== half) {
			if ((e.inn >= 10 && t > JK_SHOW.CUT_MS) || e.inn >= 11) {
				cut = true;
				push("chukei", JK_MS.chukei, 0);
				win(JK_HEAT.chukei, { kinds: ["chukei"], top: "chukei" });
				lastClose = t;
				continue;
			}
			if (half) push("change", JK_MS.change, 0);
			half = key;
			perHalf = 0;
			paInHalf = 0;
			push("half", JK_MS.halfCard, 0, { half: { inn: e.inn, top: e.top } });
		}
		let dur = 0;
		if (e.kind === "K" || e.kind === "BB" || e.kind === "walkin")
			dur = JK_MS.pa;
		else if (e.pa) dur = JK_MS.pa + JK_MS.inPlay;
		else if (
			["closer", "relief", "reliefN", "pinch", "pinchN", "defsub"].includes(
				e.kind,
			)
		)
			dur = JK_MS.card;
		else if (e.kind === "cm") dur = JK_MS.cm;
		else if (e.kind === "lucky7") dur = JK_MS.lucky7;
		else if (e.kind === "gameset") dur = JK_MS.gameset;
		else if (e.kind === "steal" || e.kind === "caught") dur = JK_MS.steal;
		if (e.kind === "walkoff") {
			// サヨナラは 直前の 打席に まとめる
			const last = [...segs].reverse().find((s) => s.play?.pa);
			if (last?.play) {
				const lp = last.play;
				lp.walkoff = true;
				const pr = segs.find((x) => x.prompt && x.prompt.play === lp);
				if (pr?.prompt) {
					pr.prompt = {
						...pr.prompt,
						kinds: [...new Set([...pr.prompt.kinds, "walkoff" as JkKind])],
						top: "walkoff",
					};
					pr.heat = JK_HEAT.walkoff;
				} else {
					push("joy", JK_MS.walkoff, 0, { play: lp });
					win(JK_HEAT.walkoff, {
						kinds: [...kindsOf(lp)],
						top: "walkoff",
						play: lp,
					});
					lastClose = t;
				}
			}
			continue;
		}
		const ks = kindsOf(e);
		let top = topOf(ks);
		if (top === "chance" && chances >= JK_SHOW.MAX_CHANCE) top = null;
		if (top === "sansha" && sansha >= 1) top = null;
		if (e.pa) paInHalf++;
		const gap = t + dur - lastClose;
		let will = false;
		if (top && JK_MUST.has(top)) will = true;
		else if (
			top &&
			!JK_GENERIC.has(top) &&
			gap >= JK_SHOW.MIN_GAP &&
			perHalf < JK_SHOW.HALF_CAP
		)
			will = true;
		else if (ks.size && gap >= JK_SHOW.GAP) {
			will = true;
			top = top ?? topOf(ks);
		}
		if (e.pa && !will && paInHalf > 4) dur = JK_MS.fast;
		push("play", dur, will ? 0 : (JK_HEAT[top ?? "minor"] ?? 0.08), {
			play: e,
		});
		if (will && top) {
			if (!JK_MUST.has(top) && !JK_GENERIC.has(top) && gap < JK_SHOW.GAP)
				perHalf++;
			if (top === "chance") chances++;
			if (top === "sansha") sansha++;
			win(JK_HEAT[top] ?? 0.1, {
				kinds: ks.size ? [...ks] : [top],
				top,
				play: e,
			});
			lastClose = t;
		}
	}
	push("flood", JK_MS.flood, 0);
	const P = segs.filter((s) => s.prompt && !s.prompt.practice).length;
	return { segs, total: t, P, cut };
};

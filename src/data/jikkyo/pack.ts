// 番組の 束（台本・会場・番組表の 決まり・会場の 文・村の 窓）。data/jikkyo/packs.ts に 並べる。
// 前からの 番組（本館の ナイター・映画館の『空飛ぶ鯖』・劇場の 紅白・議会中継）は schedule.ts・text.ts の 表の まま。
// あとから 足した 番組（銭湯の 大相撲・カジノの 競馬 ほか）は この 束 1つで 会場・日・文を 持つ：
// - 番組表（schedule.ts の programSlots）は 会場ごとに 前からの 番組 → 束の 番組の 順に 並べる。2つ 以上 なら
//   調べた ときに 番組を 選ぶ（menu の 名前）。
// - 会場の 物・人の 文（text.ts の venueLines・staffLines）は 前からの 表に なければ 束の 文。
// - 作りかけ（draft）は 番組表に 出さない（試験は 形だけ 見る）。
// 文の 幅：会場・人の 文は 村の 窓（全角 22字 × 2行）、menu は 10字（src/sim/jikkyoProgTests.ts）。

import type { JkOpt, JkScript } from "../../core/jikkyo";
import type { Today } from "../calendar";
import type { DayLines, ProgMsgKey } from "./text";

/** その 日の 枠（program・y は 番組表が 埋める。y を 書けば その 年）。 */
export type JkPackSlot = {
	readonly live: boolean;
	readonly mode?: "reha" | "rec";
	readonly day?: number;
	readonly y?: number;
};

export type JkPack = {
	readonly script: JkScript;
	/** 会場（施設か 部屋の id。cinema・theater・bath・cafe・pier など）。 */
	readonly venue: string;
	/** 見られる 町の 段（会場が 建つ 段 以上）。 */
	readonly from: number;
	/** この 段から 見られない（会場が 建てかわる とき）。 */
	readonly until?: number;
	/** 会場で 番組が 2つ 以上 ある ときの 選ぶ 名前（全角 10字まで）。 */
	readonly menu: string;
	/** その 日の 枠（null なら その 日は 流さない）。 */
	readonly slot: (t: Today) => JkPackSlot | null;
	/** 作りかけ（番組表に 出さない）。 */
	readonly draft?: boolean;
	/** 場面の 鍵（TV が 描く。試験で 時間割の scene と 照らす）。 */
	readonly scenes: readonly string[];
	/** 会場の 物の 日ごとの 文（物の id → 文。いつもの 文の 上書き）。 */
	readonly venueLines?: Readonly<Record<string, DayLines>>;
	/** 会場の 人の 日ごとの 文（人の id → 文）。 */
	readonly staffLines?: Readonly<Record<string, DayLines>>;
	/** 会場の 人が 1回だけ 言う 1行（人の id → kami・rerun → 文。rerun の {n} は のびた ★）。 */
	readonly staffOnce?: Readonly<
		Record<string, Readonly<Partial<Record<"kami" | "rerun", string>>>>
	>;
	/** 村の 窓（JK_PROG_MSG の 上書き。howto の {n} は 目標の ★、over の {n} は のびた ★）。 */
	readonly msgs?: Readonly<Partial<Record<ProgMsgKey, string>>>;
	/** 絵に 出す 文（試験で 幅と 使わない 語を 見る。全角 22字まで）。 */
	readonly art?: readonly string[];
	/** この 番組で 使わない 語（実在の 名前など。試験）。 */
	readonly deny?: readonly string[];
	/**
	 * 「保守」を 入れて よい この 番組の 固有名詞（保守場所・保守ノ海 など。群衆・題・字幕・会場の 文で だけ。
	 * キリコが 書く 文には どれも 入れない）。
	 */
	readonly names?: readonly string[];
};

// ───────────────── 日の 決まり（束の slot で 使う 小さな 道具） ─────────────────

/** 曜日が どれか（0=日〜6=土）。 */
export const onWeekdays =
	(...w: number[]) =>
	(t: Today): boolean =>
		w.includes(t.w);

/** 本番の 日なら live、ほかの 日は 再放送。 */
export const liveOr =
	(isLive: (t: Today) => boolean) =>
	(t: Today): JkPackSlot => ({ live: isLive(t) });

// ───────────────── 作りかけの 台本（draft の 束が 使う。試験の 形を みたす いちばん 小さな 台本） ─────────────────

const opt = (text: string, fit: JkOpt["fit"]): JkOpt => ({ text, fit });

/** 作りかけの 台本（区切り 1つ・窓 1つ。番組表には 出ない）。 */
export const draftScript = (
	id: string,
	venue: string,
	title: string,
): JkScript => ({
	id,
	venue,
	length: 30000,
	goal: { live: 2, rerun: 1 },
	pools: {
		wait: ["待機", "はよ"],
		open: ["たておつ", "サンイチ"],
		gap: ["次スレ　どこ？", "乱立すな"],
	},
	title: (n) => title.replace("{n}", String(n)),
	at1000: () => "1000なら　また　見る",
	open: "open",
	gapPool: "gap",
	duty: {
		pin: "950ちうい",
		first: [
			opt("立ててくる", "best"),
			opt("誰か踏め", "ok"),
			opt("ksk", "miss"),
		],
		variants: [],
	},
	quitNote: "もう一度　Bで　出る",
	bands: {},
	timeline: () => ({
		segments: [{ at: 0, scene: "card", pool: "wait", rate: 1 }],
		picks: [
			{
				at: 5000,
				sets: [
					[opt("待機", "best"), opt("はよ", "ok"), opt("乙", "miss")],
					[opt("はよ", "best"), opt("待機", "ok"), opt("乙", "miss")],
				],
			},
		],
		cues: [],
	}),
});

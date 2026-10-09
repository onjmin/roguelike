// 実況の 番組の 会場の 文（調べる 物と 人の 文の 上書き）。曜日・日付で かわる 文だけを 持つ。
// 合う 文が なければ null を 返し、呼ぶ 側（ui/facilities.ts）は いつもの 文
// （data/village/facilities.ts の room.lines・people の lines）を 読む。
// - 映画館「スクリーン1000」：金曜の 夜は 金曜ロード保守の 実況上映（スマホ OK の 上映）、ほかの 日は 再上映と 予告。
//   絵は ui/cinemaDecor.ts。
// - 保守劇場：12月は 紅白スレ合戦（12/31 本番・12/1〜30 公開リハ）、1/1〜7 は 去年の 回の 録画。ほかの 月は いつもの 文。
//   {kai} は 回（年 − 2011）で 埋める。
// ほかに 番組の あとで 係員が 1回だけ 言う 1行（STAFF_ONCE）、おんJの 決まり文句（分かち書きの 試験の 白い 一覧）、
// 番組の 村の 窓・板・結果カードの 字（ui/jikkyoWatch.ts）。
// 番組名・映画の 題は 架空の パロディで、実在の 番組・局・映画とは 関係が ない。
// どの 文も 村の 窓（全角 22字 × 2行）に 収める（src/sim/jikkyoTests.ts）。

import type { Today } from "../calendar";
import { kohakuKai } from "./kohaku";
import { PACKS } from "./packs";

/** 金曜ロード保守の 夜（金曜）。映画館は 実況上映。 */
export const isRoadshowNight = (t: Today): boolean => t.w === 5;

/** 劇場の 紅白の 枠（12/31 本番・12/1〜30 公開リハ・1/1〜7 録画。ほかの 日は null）。 */
export const kohakuMode = (t: Today): "live" | "reha" | "rec" | null => {
	if (t.m === 12 && t.d === 31) return "live";
	if (t.m === 12 && t.d >= 1 && t.d <= 30) return "reha";
	if (t.m === 1 && t.d >= 1 && t.d <= 7) return "rec";
	return null;
};
const isMode = (m: "live" | "reha" | "rec") => (t: Today) =>
	kohakuMode(t) === m;
const isDecember = (t: Today): boolean => t.m === 12;

/** 日に よって かわる 文（上から 見て、はじめに 合った 文。どれも 合わなければ いつもの 文）。 */
export type DayLines = readonly {
	when: (t: Today) => boolean;
	lines: readonly string[];
}[];

const anyDay = (): boolean => true;

/** 会場の 物の 文（施設の id → 物の id → 日ごとの 文）。 */
export const VENUE_LINES: Readonly<
	Record<string, Readonly<Record<string, DayLines>>>
> = {
	cinema: {
		screen: [
			{
				when: isRoadshowNight,
				lines: ["スクリーン。\n今夜は『空飛ぶ鯖』の　実況上映。"],
			},
			{ when: anyDay, lines: ["スクリーン。\n今日は『空飛ぶ鯖』の　再上映。"] },
		],
		poster: [
			{
				when: isRoadshowNight,
				lines: ["今夜　実況上映『空飛ぶ鯖』\nスマホ　OK、音は　消してな"],
			},
			{
				when: anyDay,
				lines: ["金曜の　夜は　実況上映\n近日『1000レスの　夏』"],
			},
		],
		seat: [
			{
				when: isRoadshowNight,
				lines: ["客席。\nスマホの　光が　ならんでいる。"],
			},
		],
	},
	theater: {
		stage: [
			{
				when: isMode("live"),
				lines: ["舞台。\n今夜は『第{kai}回　紅白スレ合戦』。"],
			},
			{
				when: isMode("reha"),
				lines: ["舞台。\n『紅白スレ合戦』の　公開リハ。"],
			},
			{
				when: isMode("rec"),
				lines: ["舞台。\n『紅白スレ合戦』の　録画を　流している。"],
			},
		],
		playbill: [
			{
				when: isDecember,
				lines: ["演目の　はり紙。\n大みそか『紅白スレ合戦』"],
			},
			{
				when: isMode("rec"),
				lines: ["演目の　はり紙。\n録画上映『紅白スレ合戦』"],
			},
		],
	},
};

/** 会場の 人の 文（施設の id → 人の id → 日ごとの 文）。 */
export const STAFF_LINES: Readonly<
	Record<string, Readonly<Record<string, DayLines>>>
> = {
	cinema: {
		cinema_staff: [
			{
				when: isRoadshowNight,
				lines: ["今夜は　金曜ロード保守の　実況上映や。\n……実況は　実況スレで"],
			},
		],
	},
	theater: {
		theater_actor: [
			{ when: isMode("live"), lines: ["今夜は　本番や。\n……セリフ、忘れた"] },
			{
				when: isMode("reha"),
				lines: ["大みそかの　夜は、\n『紅白スレ合戦』の　本番やで"],
			},
			{ when: isMode("rec"), lines: ["去年の　紅白、\n録画で　流しとるで"] },
		],
	},
};

/** {kai}（紅白の 回）を 埋める。 */
const fillKai = (lines: readonly string[], y: number): readonly string[] =>
	lines.map((l) => l.replaceAll("{kai}", String(kohakuKai(y))));

const pick = (
	d: DayLines | undefined,
	t: Today,
	y: number,
): readonly string[] | null => {
	const ls = d?.find((r) => r.when(t))?.lines;
	return ls ? fillKai(ls, y) : null;
};

/** 束の 番組（data/jikkyo/packs.ts）の 会場の 文（作りかけは 読まない。前からの 表の あと）。 */
const packLines = (
	fid: string,
	key: string,
	t: Today,
	y: number,
	of: "venueLines" | "staffLines",
): readonly string[] | null => {
	for (const p of PACKS) {
		if (p.draft || p.venue !== fid) continue;
		const ls = pick(p[of]?.[key], t, y);
		if (ls) return ls;
	}
	return null;
};

/** 会場の 物の 文の 上書き（無ければ null。いつもの room.lines を 読む）。y は 年（紅白の 回）。 */
export const venueLines = (
	fid: string,
	kind: string,
	t: Today,
	y = new Date().getFullYear(),
): readonly string[] | null =>
	pick(VENUE_LINES[fid]?.[kind], t, y) ??
	packLines(fid, kind, t, y, "venueLines");

/** 会場の 人の 文の 上書き（無ければ null。いつもの lines を 読む）。 */
export const staffLines = (
	fid: string,
	who: string,
	t: Today,
	y = new Date().getFullYear(),
): readonly string[] | null =>
	pick(STAFF_LINES[fid]?.[who], t, y) ??
	packLines(fid, who, t, y, "staffLines");

/**
 * 会場の 人が 1回だけ 言う 1行（番組の 記録から。施設の id → 人の id → 鍵 → 文）。
 * rerun は 再上映で のびた ★（{n}）、kami は 山場の 神エイムの あと。どちらも 言ったら もう 言わない。
 */
export const STAFF_ONCE: Readonly<
	Record<string, Readonly<Record<string, Readonly<Record<string, string>>>>>
> = {
	cinema: {
		cinema_staff: {
			kami: "この前の　バルス、\nぴったり　やったな",
			rerun: "この前は　★{n}まで　のびたな。\n金曜の　夜は、もっと　のびるで",
		},
	},
	theater: {
		theater_actor: {
			kami: "0時の　あけおめ、\nぴったり　やったな",
		},
	},
};

/**
 * おんJの 決まり文句（スレの つづりの まま。全角スペースで 区切らない）。
 * それ以外で かな・漢字が 6字 以上 つづく レスは 全角スペースで 区切る（試験）。
 */
export const ONJ_PHRASES: readonly string[] = [
	"ここすき",
	"飯テロ",
	"今北産業",
	"これは大関",
	"これは横綱",
	"善戦定期",
	"サンキュー速記ニキ",
	"ksk",
	"8888",
	"950ちうい",
	"たておつ",
	"サンイチ",
	"はじまた",
	"リマスターかよ",
	"準備できた",
	"やりきった",
	"ありがとう",
	"くるうううう",
	"新年だああああ",
	"終わっちゃった",
];

/** 番組の 村の 窓（全角 22字 × 2行。キリコは しゃべらない）。 */
export const JK_PROG_MSG = {
	menu: ["見る", "やめる"],
	howto: "見せ場に　合う　レスを　えらぶと、\nスレが　のびる。目標：★{n}　完走",
	seat: "キリコは　席に　ついた。\n……スマホで、実況スレを　ひらく。",
	over: "上映が　おわった。\n実況は　★{n}まで　のびた。",
	kanso: "……完走。",
	kami: "あの　ひとことは、\nぴったりの　一瞬だった。",
	left: "……上映の　とちゅうで、\nそっと　席を　立った。",
} as const;

export type ProgMsgKey = Exclude<keyof typeof JK_PROG_MSG, "menu">;

/** 番組ごとに かえる 村の 窓（無い 鍵は JK_PROG_MSG）。 */
export const JK_PROG_MSGS: Readonly<
	Record<string, { readonly [K in ProgMsgKey]?: string }>
> = {
	kohaku: {
		seat: "キリコは　客席に　ついた。\n……スマホで、実況スレを　ひらく。",
		over: "幕が　おりた。\n実況は　★{n}まで　のびた。",
		kami: "名前欄に「あけおめ＠大吉」。\n……ぴったりの　0時だった。",
		left: "……公演の　とちゅうで、\nそっと　席を　立った。",
	},
};

/** その 番組の 村の 窓（束の 番組は 束の msgs）。 */
export const progMsg = (
	id: string,
): { readonly menu: readonly string[] } & Record<ProgMsgKey, string> => ({
	...JK_PROG_MSG,
	...JK_PROG_MSGS[id],
	...PACKS.find((p) => p.script.id === id)?.msgs,
});

/** 番組の 板と TV の 小さな 字（全角 22字まで）。 */
export const JK_PROG_TV = {
	hint: "↑↓　えらぶ　A　書きこむ　B　出る",
	picks: "書きこむ　レスを　えらぶ",
	res: "レス　{no}／1000",
	ikioi: "勢い　{ikioi}",
	duty: "950：次スレを　どうする？",
	cue: "合図の　次の　拍で　書きこむ",
	stall: "鯖が　重い……",
	gap: "次スレ　まち……",
	kansoTv: "スレ　完走！",
	close: "とじる",
	grade: {
		kami: "神エイム！",
		oshii: "おしい",
		late: "おくれた",
		flying: "フライング",
		none: "見てただけ",
	},
	gradeNote: "{g}　+{gain}",
	best: "◎　的確！　+{g}",
	ok: "○　まあまあ　+{g}",
	miss: "×　スベった　+{g}",
	silent: "◎　だまって　聞いた　+{g}",
	late: "見送り……",
	fast: "神速",
	combo: "{c}連続",
} as const;

/** 番組の 結果カード（全角 22字まで）。 */
export const JK_PROG_RESULT = {
	over: "★{n}まで　のびた",
	kanso: "完走！　目標の　★{goal}",
	res: "{res}レス",
	ikioi: "最高の　勢い　{ikioi}",
	combo: "最高コンボ　{c}連続",
	fits: "◎{x}　○{y}　×{z}　見送り{w}",
	cue: "山場：{g}",
	best: "これまでの　最高　★{best}",
	new: "NEW!",
} as const;

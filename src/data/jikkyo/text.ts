// 実況の 番組の 会場の 文（調べる 物と 人の 文の 上書き）。曜日・日付で かわる 文だけを 持つ。
// 合う 文が なければ null を 返し、呼ぶ 側（ui/facilities.ts）は いつもの 文
// （data/village/facilities.ts の room.lines・people の lines）を 読む。
// いまは 映画館「スクリーン1000」だけ：金曜の 夜は 金曜ロード保守の 実況上映（スマホ OK の 上映）、
// ほかの 日は 再上映と 予告。絵は ui/cinemaDecor.ts。
// ほかに 番組の あとで 係員が 1回だけ 言う 1行（STAFF_ONCE）、おんJの 決まり文句（分かち書きの 試験の 白い 一覧）、
// 番組の 村の 窓・板・結果カードの 字（ui/jikkyoWatch.ts）。
// 番組名・映画の 題は 架空の パロディで、実在の 番組・局・映画とは 関係が ない。
// どの 文も 村の 窓（全角 22字 × 2行）に 収める（src/sim/jikkyoTests.ts）。

import type { Today } from "../calendar";

/** 金曜ロード保守の 夜（金曜）。映画館は 実況上映。 */
export const isRoadshowNight = (t: Today): boolean => t.w === 5;

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
};

const pick = (d: DayLines | undefined, t: Today): readonly string[] | null =>
	d?.find((r) => r.when(t))?.lines ?? null;

/** 会場の 物の 文の 上書き（無ければ null。いつもの room.lines を 読む）。 */
export const venueLines = (
	fid: string,
	kind: string,
	t: Today,
): readonly string[] | null => pick(VENUE_LINES[fid]?.[kind], t);

/** 会場の 人の 文の 上書き（無ければ null。いつもの lines を 読む）。 */
export const staffLines = (
	fid: string,
	who: string,
	t: Today,
): readonly string[] | null => pick(STAFF_LINES[fid]?.[who], t);

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

// 広場の 掲示板の 名無しの 見出しと 書きこみ（STORY.md §4.9。正体は やきう、転で わかる）。
// - 見出し：板が 開いて 持ち帰るまで 1本（騒ぎを 盛った 見出し。話を 追う ごとに 雑に なる）。
// - 倒れた ときの 一行：倒れて 帰る たびに 1つ ふえる（いちばん 無責任な 一行。転の「ずっと見てた」の 答え）。
// どの 行も 村の 窓（全角 22字・2行）に 収める。DOM も 保存も 使わない。

import type { DungeonId } from "../../core/types";

/** 板 → 名無しの 見出し（本筋の 順に 雑に なる。最後は かっこも 漢字も ない）。 */
export const HEADLINES: Partial<Record<DungeonId, string>> = {
	shallow: "【悲報】パン板、独立を宣言",
	kinoko: "【速報】きのこ軍上陸ｗｗｗ",
	tropical: "【悲報】浜、島になる",
	konamono: "【悲報】おんたこ宣戦布告か😡",
	main: "【ｿｸﾎｳ】銭湯陥落",
	festival: "太鼓とまらん",
	deep: "おんJタウンしゅうりょう",
};

/** 最終話の あと（鯖代の 払い忘れで ロールバック）の 見出し。 */
export const ROLLBACK_HEADLINE = "【悲報】ワイらの冒険、ロールバック";

/**
 * 倒れて 帰る たびに 掲示板に ふえる 一行。倒れた 回数で 段が 上がり、段の 中で 順に まわる
 * （1〜2回：おもしろがる → 3回〜：慣れる → 10回〜：数える → 30回〜：伝統芸能）。{n} は 回数。
 */
export const DEATH_TIERS: readonly {
	from: number;
	lines: readonly string[];
}[] = [
	{ from: 1, lines: ["キリコ死んでて草", "また死んどる"] },
	{
		from: 3,
		lines: [
			"持ち物ぜんぶ落としたらしいで",
			"死に戻り定期",
			"ワイなら3階で帰っとるわ",
			"ぷゆゆパン食べたんか？",
			"知ってた",
			"今日の死因はなんや",
		],
	},
	{
		from: 10,
		lines: [
			"{n}回目で草",
			"死亡実況スレ、立てといたで",
			"もう死ぬ前提で見とる",
			"広場にキリコの墓、建てよか",
		],
	},
	{
		from: 30,
		lines: [
			"{n}回目。もう伝統芸能や",
			"死んでへん日のほうがニュース",
			"残機、ワイより多いやろ",
			"死ぬのが仕事の人",
		],
	},
];

/** ぜんぶの 段の 行（窓に 収まるかの 試験用）。 */
export const DEATH_LINES: readonly string[] = DEATH_TIERS.flatMap(
	(t) => t.lines,
);

/** n 回目（1 から）に 倒れて 帰った ときの 一行。 */
export const deathLine = (n: number): string => {
	const k = Math.max(1, Math.floor(n));
	const tier =
		[...DEATH_TIERS].reverse().find((t) => k >= t.from) ?? DEATH_TIERS[0];
	return tier.lines[(k - tier.from) % tier.lines.length].replaceAll(
		"{n}",
		String(k),
	);
};

/** 掲示板の 文（村の 窓）。 */
export const BOARD_NEWS = {
	/** 見出し（{line} は 見出し）。 */
	headline: "名無しのスレが立っている。\n『{line}』",
	/** 倒れた 帰りに 1回（{line} は 一行）。 */
	death: "広場の掲示板に、書きこみがふえた。\n「{line}」",
	/** 掲示板を 調べた とき（{line} は いちばん 新しい 一行）。 */
	deathOnBoard: "いちばん下の書きこみ：\n「{line}」",
} as const;

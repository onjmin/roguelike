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

/** 倒れて 帰る たびに 掲示板に ふえる 一行（何回目かで 決まる）。 */
export const DEATH_LINES: readonly string[] = [
	"キリコ死んでて草",
	"また死んどる",
	"持ち物ぜんぶ落としたらしいで",
	"死に戻り定期",
	"ワイなら3階で帰っとるわ",
	"ぷゆゆパン食べたんか？",
	"知ってた",
	"今日の死因はなんや",
];

/** n 回目（1 から）に 倒れて 帰った ときの 一行。 */
export const deathLine = (n: number): string =>
	DEATH_LINES[(Math.max(1, Math.floor(n)) - 1) % DEATH_LINES.length];

/** 掲示板の 文（村の 窓）。 */
export const BOARD_NEWS = {
	/** 見出し（{line} は 見出し）。 */
	headline: "名無しのスレが立っている。\n『{line}』",
	/** 倒れた 帰りに 1回（{line} は 一行）。 */
	death: "広場の掲示板に、書きこみがふえた。\n「{line}」",
	/** 掲示板を 調べた とき（{line} は いちばん 新しい 一行）。 */
	deathOnBoard: "いちばん下の書きこみ：\n「{line}」",
} as const;

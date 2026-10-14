// 町の 寄り道で 見つける 板（2026-10-14 作者：1回で 完結する 寄り道の 板は、板の 踏破では なく
// おんJタウンの ちょっとした 出来事で 開く）。施設の 物を 調べた・人に 話した あとに 1回だけ 起きて、
// 板が 開き、「〜に もぐれるように なった」と 知らせる（ui/village/finds.ts）。
// 開く 旗は town_〈板〉（core/data/dungeons.ts の unlockFlag）。
// 1行は 全角22字・2行まで（村の 窓と 同じ）。

import type { DungeonId } from "../../core/types";

export type TownFind = {
	dungeon: DungeonId;
	/** 施設の id（data/village/facilities.ts）。 */
	facility: string;
	/** 調べる 物の id か、話す 人の id。 */
	at: string;
	/** 町が この 段に なってから（無ければ 施設が 建てば）。 */
	stage?: number;
	/** この 板が 開いてから（おんキムは おんMuの あと：植民地戦争）。 */
	after?: DungeonId;
	/** who が あれば その 人の セリフ（名前欄）、無ければ 地の文。 */
	lines: readonly { who?: string; text: string }[];
};

export const TOWN_FINDS: readonly TownFind[] = [
	// 裏シナリオの 入口：釣り場の 竿に ビン。板を 立てて 名前を 変えられた 人の 手紙（掲示板の「板　立てたわ」の 人）
	{
		dungeon: "isle1",
		facility: "pier",
		at: "rod",
		stage: 1,
		lines: [
			{
				text: "竿の　先に、ビンが　ひっかかった。\n中に　紙きれが　入っている。",
			},
			{
				text: "「板　立てたけど、名前を　変えられた。\n……だれか、取り返してくれ」",
			},
			{ text: "見ると、南西の　小島の　岸に\n小舟が　ついていた。" },
		],
	},
	// マーキュリー（おんJに 飽きた 人の ほのぼの 板）：碁会所の 常連の 碁敵が 越していった
	{
		dungeon: "mercury",
		facility: "go",
		at: "go_a",
		lines: [
			{
				who: "名無し",
				text: "ワイの　碁敵な、おんJに　飽きて\n水星に　行ってもうたんや",
			},
			{
				who: "名無し",
				text: "マーキュリーいう　板や。\n……のんびり　打っとるらしいで",
			},
			{ text: "名無しは　碁盤の　はしに、\n板の　場所を　書いてくれた。" },
		],
	},
	// おんMu（呑気な おんJを 求めて 作られ、沈んだ 大陸）：質流れの 旅の パンフレット
	{
		dungeon: "onmu",
		facility: "pawn",
		at: "case",
		lines: [
			{ text: "ケースの　すみに、色あせた\nパンフレット。「流れ品」の　札。" },
			{ text: "「新境地への　旅行　はじめり」\n……行き先は、ムー大陸。" },
			{ text: "うらに、板の　住所。\n……大陸ごと、沈んでいる　らしい。" },
		],
	},
	// おんキム（キムチと 勧誘。おんMuと 植民地戦争）：おんJマートの はり紙に 勧誘が かさねて 貼られる
	{
		dungeon: "onkimu",
		facility: "konbini",
		at: "notice",
		after: "onmu",
		lines: [
			{ text: "はり紙の　上に、もう　1枚。\n「おんキムに　来ませんか？」" },
			{ text: "「キムチ　あります。おんMuより\nにぎやかです」……勧誘だ。" },
		],
	},
	// †ダークネスインフェルノ†板（中二病 専用板）：道場の 木刀に 彫った 字
	{
		dungeon: "inferno",
		facility: "dojo",
		at: "bokken",
		lines: [
			{ text: "木刀の　1本に、黒い　字。\n「†漆黒の　闇より　来たりし†」" },
			{
				text: "その　下に、小さく　板の　名前。\n……持ち主は、もう　来ていない　らしい。",
			},
		],
	},
];

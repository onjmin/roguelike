// 建物の 電光表示・案内板に 映す 字（2026-10-16 作者：「ディスプレイに 映せる ものが あるなら できるだけ 映した 方が いい。
// 文字とか」）。絵の 黒い 画面（led）・あかりの 入った 白い 面（lightbox）・駅の 発車案内の 下の 黒い 帯（board）に
// 字を 流す（ui/village/displays.ts が 描く）。おんJ証券の 株価は ui/trade/stockBoardDecor.ts。
// 字は 看板の 字なので 分かち書き しない。ゲームの 中に ない 物（無い 遊び・無い 時刻表）は 書かない。

import { isRoadshowNight } from "../jikkyo/text";
import type { Today } from "../town/calendar";

/** 画面の 種類（絵の どこに 映すかと 色）。 */
export type DisplayFace = "led" | "lightbox" | "board";

/** 字の 色（led・board は 光る 字、lightbox は 白い 面の 黒い 字）。 */
export type Ink = "amber" | "red" | "green" | "white" | "dark";

export type DisplayLine = readonly (readonly [text: string, ink?: Ink])[];

export type DisplayDef = {
	facility: string;
	/** 外観（村の 地図）か 中（施設の 部屋）か。 */
	where: "outside" | "inside";
	/** 画面の 絵の マスの 字（行の 中で 左から 並ぶ。外観の rows・部屋の rows）。 */
	key: string;
	face: DisplayFace;
	/** 流す 字（地図を 組む ときに 決める）。 */
	text: (t: Today) => DisplayLine;
	/** 流さずに まんなかに 止める（短い 字）。 */
	still?: true;
	/** ぱっぱっと 点滅する（ON AIR）。 */
	blink?: true;
};

const SEP: readonly [string, Ink] = ["　◆　", "white"];

export const DISPLAYS: readonly DisplayDef[] = [
	{
		facility: "cinema",
		where: "outside",
		key: "1234",
		face: "led",
		text: (t) =>
			isRoadshowNight(t)
				? [
						["今夜", "red"],
						["　金曜ロード保守実況上映", "amber"],
						SEP,
						["スクリーン1000", "amber"],
					]
				: [
						["予告編上映中", "amber"],
						SEP,
						["金曜の夜は金曜ロード保守", "amber"],
						SEP,
						["スクリーン1000", "amber"],
					],
	},
	{
		facility: "casino",
		where: "outside",
		key: "1234",
		face: "led",
		text: () => [
			["カジノガチャ", "red"],
			SEP,
			["ポーカー・ブラックジャック・バカラ・ルーレット", "amber"],
			SEP,
			["チップの換金はカウンターで", "green"],
		],
	},
	{
		facility: "tvstudio",
		where: "outside",
		key: "1234",
		face: "led",
		text: () => [
			["ON AIR", "red"],
			["　おんJテレビ", "amber"],
			SEP,
			["ご意見・ご感想は掲示板へ", "green"],
		],
	},
	{
		facility: "tvstudio",
		where: "inside",
		key: "oa",
		face: "led",
		text: () => [["ON AIR", "red"]],
		still: true,
		blink: true,
	},
	{
		facility: "netcafe",
		where: "outside",
		key: "12",
		face: "lightbox",
		text: () => [["ネット・漫画・シャワー24時間営業", "dark"]],
	},
	{
		facility: "zakkyo",
		where: "outside",
		key: "12",
		face: "lightbox",
		text: () => [["テナント募集中", "dark"]],
	},
	{
		facility: "station",
		where: "outside",
		key: "pPqQ",
		face: "lightbox",
		text: () => [
			["おんJタウン駅", "dark"],
			["　◆　", "dark"],
			["ぷゆゆ列車は不定期運行です", "dark"],
		],
	},
	{
		facility: "station",
		where: "inside",
		key: "abcd",
		face: "lightbox",
		text: () => [["発車案内", "dark"]],
		still: true,
	},
	{
		facility: "station",
		where: "inside",
		key: "1234",
		face: "board",
		text: () => [
			["ぷゆゆ列車", "amber"],
			["　不定期", "green"],
			SEP,
			["白線の内側でお待ちください", "amber"],
		],
	},
];

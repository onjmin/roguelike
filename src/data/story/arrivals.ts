// 越してくる 住人の 場面（動かすのは ui/village/arrivals.ts）。板を 持ち帰った あとで、町はずれの その 場所（at）に
// 来ると 起きる。港と 広場を むすぶ 本筋の 道から 外れた 行き止まりに 置く（2026-10-19 作者「隅々まで 調べる 人が
// 見られる イベント」）。来なければ 越してこない。
// 越してくる 子が キリコの そばまで 歩いて きて、自己紹介 → 201 の 型の ドタバタ（町 → 日本 → 宇宙と 大きく して、
// 最後に キリコが つっこむ）→ 持ち場へ 歩いて いく。見おえるまで その 子は 町に いない（data/people/mobs.ts の awayMobs）。
// 帰りの 2幕目（続きの 場面）を 待つ あいだは 起きない（ui/village/skits.ts の holdSkits と 同じ）。
// 自己紹介を かねるので ふつうの 寸劇（3〜5窓）より 長い。1行は 全角22字・2行まで。
//
// - デンちゃん：電池板の マスコット（おんJwiki「でんちゃん＆デンちゃん」）。体の 中で いつも 発電して いて、人に
//   感電しない ように ゴム手袋を して いる ツインテール。電池板の 見学コースで 案内係を して いる（core/data/dungeons.ts）。
// - まとめ三人娘：おんJの まとめブログの 看板娘（おんJwiki「なんJやきう関係ない部＠おんJ」「なんまめ」「さっぱりピーマン」）。
//   関係ない部ちゃんは 痴呆と 呼ばれた 管理人の 擬人化（定期スレを 何本でも まとめる・最初の 記事は 若鷹弁）、
//   なんまめちゃんは 何も 書かずに 青字・赤字で だけ 答える（コメントは いつも 0件）、サッピーは ピーマンの 妖精で
//   中身が 無く、影が うすく、ほかの 管理人キャラに よく 焼かれる。板とは かかわりが ないので 町の 出来事で 来る。
// - フランソワ・チュパカブラ：ニュー速VIP の お嬢さま口調の コテハン（Vikipedia）。滋賀在住・ローソンの バイト・
//   全レス・顔文字 ζ 'ヮ')ζ。板とは かかわりが ないので 町の 出来事で 来る。

import type { DungeonId } from "../../core/types";
import type { Cue } from "../../engine/emote";
import type { SceneFx } from "../../engine/sceneFx";
import type { MobId } from "../people/mobs";

/** 1窓。who は キリコ・地の文（null）・越してくる 子（その 場面の mobs の だれか）。 */
export type ArrivalLine = Cue & {
	who: "kiriko" | null | MobId;
	text: string;
	/** この 窓の 前に 出す エフェクト（engine/sceneFx.ts。calm か 場面の 終わりまで 残る。爆発の 煙は その 前に ひとりでに 晴れる）。 */
	fx?: SceneFx;
	/** この 窓の 前に エフェクトを 消す。 */
	calm?: true;
};

export type Arrival = {
	key: string;
	/** この 板を 持ち帰った あとの 帰りに 起きる。 */
	after: DungeonId;
	/** 越してくる 子（歩いて くる 順）。 */
	mobs: readonly MobId[];
	/** 起きる 所（村の 地図の この 四角に 来たら。x・y の はしを 含む）と、キリコが 向く 話の もとの マス。 */
	at: {
		x: readonly [number, number];
		y: readonly [number, number];
		face: readonly [number, number];
	};
	lines: readonly ArrivalLine[];
};

const k = (text: string): ArrivalLine => ({ who: "kiriko", text });
const n = (text: string): ArrivalLine => ({ who: null, text });
const by =
	(who: MobId) =>
	(text: string): ArrivalLine => ({ who, text });
const e = (cue: Cue, line: ArrivalLine): ArrivalLine => ({ ...line, ...cue });

const den = by("den");
const kankei = by("kankei");
const nanmame = by("nanmame");
const sappy = by("sappy");
const chupa = by("chupa");

export const ARRIVALS: readonly Arrival[] = [
	// きのこ板の あと：商店街が もどった 町を まとめに 来る。歩いた だけで 定期スレに され、日本じゅうに 転載され、
	// 宇宙版まで 出て、記念に サッピーが 焼かれる
	{
		key: "arrive_matome",
		after: "kinoko",
		mobs: ["kankei", "nanmame", "sappy"],
		// 北東の 住宅街の 奥の 空き地（家の 並びの 東の 行き止まり）
		at: { x: [57, 61], y: [8, 10], face: [61, 9] },
		lines: [
			n("ノートパソコンをかかえた\n女の子が3人、歩いてきた。"),
			e(
				{ gesture: "hop" },
				kankei("なんJやきう関係ない部\n＠おんJの、関係ない部ちゃんばい！"),
			),
			nanmame("【青字】なんまめです"),
			sappy("さっぱりピーマンのサッピー。\n……中身はないよ"),
			e({ emote: "?" }, k("まとめブログの人ンゴ？\n何しに来たンゴ？")),
			kankei("この町、まとめに来たばい！\nまず「キリコ、歩く」"),
			kankei("つぎ「キリコ、また歩く」\n「【定期】キリコ、歩く」"),
			e({ emote: "得" }, kankei("今日だけで\n300本まとめたばい！")),
			nanmame("【青字】日本じゅうの\nまとめに転載しました"),
			nanmame("【青字】宇宙版も\n作りました（コメント0件）"),
			e({ emote: "驚", hit: "slap" }, k("歩いただけで\n記事にしないでンゴ！")),
			kankei("記念に、サッピーば\n焼いてお祝いするばい！"),
			e(
				{ emote: "青", hit: "sting", gesture: "shake" },
				sappy("なんで毎回、\nわたしが焼かれるの！？"),
			),
			e(
				{ emote: "驚", hit: "whack", pause: 400 },
				k("まとめる前に\n消火するンゴ！！"),
			),
			sappy("……さっぱりピーマン、\nわけわかめ"),
		],
	},
	// 風呂板の あと：滋賀から 全レスしに 来た お嬢さま。返事の 相手が キリコ → 町の 看板 → 海 → 宇宙と ふえる
	{
		key: "arrive_chupa",
		after: "main",
		mobs: ["chupa"],
		// 北西の 神社の 下の 空き地
		at: { x: [1, 7], y: [10, 11], face: [3, 9] },
		lines: [
			n("金色のたて巻きの\nお嬢さまが、歩いてきた。"),
			chupa("ごきげんよう。ニュー速VIPの\nフランソワ・チュパカブラですわ"),
			chupa("滋賀から、全レスしに\n参りましたの　ζ 'ヮ')ζ"),
			e({ emote: "?" }, k("全レスってなにンゴ？")),
			chupa("書かれたことに、\nぜんぶお返事することですわ"),
			chupa("まずキリコさまの\n「なにンゴ？」に、お返事ですわ"),
			chupa("町の看板の皆さまにも、\n1枚ずつお返事ですわ！"),
			chupa("波の音さまの\n「ザザーン」にも、お返事ですわ！"),
			e(
				{ emote: "得" },
				chupa("宇宙の皆さまの\n137億年ぶんにも、お返事ですわ！"),
			),
			e(
				{ emote: "驚", hit: "whack", pause: 400 },
				k("返事が宇宙の\n年齢まで来たンゴ！！"),
			),
			chupa("それでは、コンビニの\nバイトがありますの"),
			chupa("……あら、いまのツッコミにも\nお返事しなくては！"),
			e({ emote: "冷" }, k("もういいンゴ……")),
		],
	},
	// 電池板の あと：見学コースの 案内係が 越してくる。握手の ために 手袋を とったら 町・日本・宇宙まで 送電する
	{
		key: "arrive_den",
		after: "deep",
		mobs: ["den"],
		// 南西の 鯖（サーバー）の 並びの 西の はし（電源の そば）
		at: { x: [0, 4], y: [44, 44], face: [1, 43] },
		lines: [
			n("ゴム手袋をした\nツインテールの子が、歩いてきた。"),
			e({ gesture: "hop" }, den("見学コースの案内係、\nデンちゃんです！")),
			den("てっぺんが片づいたので、\nこの町に住みにきました！"),
			e({ emote: "!" }, k("あのときの案内係ンゴ！")),
			den("はじめましての握手を……\nあ、手袋とりますね"),
			e({ emote: "驚", hit: "boom" }, n("キリコの髪が、\nぜんぶ逆立った。")),
			den("あっ、うれしくて\n町じゅうに送電しちゃいました"),
			den("ついでに日本の電気も、\nぜんぶまかなっときました"),
			e({ emote: "得" }, den("宇宙ステーションにも、\nおすそわけです！")),
			e({ emote: "驚", hit: "whack", pause: 400 }, k("手袋はめるンゴ！！")),
			den("はーい！電気代は、\nだれも払ってないですけど！"),
		],
	},
];

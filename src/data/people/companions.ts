// 同行の 依頼（2026-10-14 作者：「一人じゃ 心細いけど 見に行きたい」「ポケダンの 依頼も 参考に」「本筋で 毎回 同行を
// 要求されるのは くどいので、寄り道程度で」）。
// - 村の まとめ掲示板に はり紙で 出る（村の 機能は 物に。ui/village/villageEvents.ts の boardScript）。引き受けるかは 選ぶ。
// - 依頼は 持ち帰った ことの ある 板だけ（本筋の 山場の 冒険には ついてこない）。1つずつ 引き受ける。
// - 引き受けた あと その 板へ 出ると、依頼主が ついてくる（core/guest.ts）。見たかった 階に 着くと 満足して 村へ 帰り、
//   帰ってきた キリコに お礼（少しの お金）。たおれたら 依頼は そのまま（また 行ける）。
// - 依頼主が 村に まだ いない・冒険に 出る 主人公（ロゼ・ゼロ）と 同じ 人なら、その 冒険には ついてこない。
// やきうは 依頼しない（現職。自分の 遊説で いそがしい）。

import type { HeroId } from "../../core/data/heroes";
import { townStep } from "../../core/town";
import type { DungeonId, GuestId, GuestSpec } from "../../core/types";
import type { Cue } from "../../engine/emote";
import type { Speaker } from "../story/quotes";
import { awayFriends } from "../story/story";
import { CAST } from "./cast";
import { MOBS, type MobId, movedIn } from "./mobs";

export type EscortRequest = {
	id: string;
	who: GuestId;
	/** 行き先（持ち帰った ことの ある 板）。 */
	board: DungeonId;
	/** 見たい 階（ここに 着いたら 満足して 帰る）。 */
	goal: number;
	/** はり紙の 題（一覧の 1行。全角 16字まで）。 */
	title: string;
	/** 依頼の 文（はり紙を 読んだ とき。依頼主の 声で 1〜2窓）。 */
	ask: readonly string[];
	/** その 板へ 出る ときの 地の文と ひとこと。 */
	join: string;
	line: string;
	/** line の 感情の 記号・体の 動き（engine/emote.ts。依頼主の 頭に）。 */
	lineCue?: Cue;
	/** 帰ってきた とき（1〜2窓）。 */
	thanks: readonly string[];
	/** thanks の 1窓目の 感情の 記号・体の 動き。 */
	thanksCue?: Cue;
	/** お礼（円）。 */
	reward: number;
	/** この 板も 持ち帰って いれば 出る（裏の 依頼）。 */
	need?: DungeonId;
};

export const ESCORTS: readonly EscortRequest[] = [
	{
		id: "panmatsu_pan",
		who: "panmatsu",
		board: "shallow",
		goal: 3,
		title: "本家の　視察",
		ask: [
			"パン板の　本家を\n視察したい",
			"……出張所の　者が　ひとりで\n行くのは、部下に　示しが　つかん",
		],
		join: "パン松が　パンを　かかえて　ついてきた。",
		line: "視察だ。\n……手荒な　まねは　しない",
		thanks: [
			"本家は、まだ　パンの\nにおいが　した",
			"……パンを　食え。\nそれと、礼だ",
		],
		reward: 300,
	},
	{
		id: "roze_kinoko",
		who: "roze",
		board: "kinoko",
		goal: 4,
		title: "むかし　来た　板",
		ask: [
			"むかし　来た　きのこ板、\nもう一度　見たいアル",
			"……ひとりは　心細いアル。\n4階まで、いっしょに　来てほしいアル",
		],
		join: "ロゼが　鍋を　置いて　ついてきた。",
		line: "きのこ板、ひさしぶりアル。\n……案内は　いらないアル",
		thanks: [
			"……見てきたアル。\n変わってなかったアル",
			"変わらないのも、常識アル。\n……お礼アル",
		],
		reward: 300,
	},
	{
		id: "shiyo_bath",
		who: "shiyo",
		board: "main",
		goal: 8,
		title: "湯治の　つきそい",
		ask: [
			"……べ、べつに　湯治に\n行きたい　わけじゃ　ないわよ",
			"でも、ひとりは　ちょっと……。\n8階まで、つきあいなさいよ",
		],
		join: "シヨが　タオルを　かかえて　ついてきた。",
		line: "……湯治よ、湯治。\nあなたは　ついでよ",
		lineCue: { emote: "汗" },
		thanks: [
			"……いい　お湯だったわ。\nべ、べつに　楽しかった　わけじゃ……",
			"お礼よ。\n……受けとりなさいよ",
		],
		thanksCue: { emote: "花" },
		reward: 400,
	},
	{
		id: "feris_island",
		who: "feris",
		board: "tropical",
		goal: 6,
		title: "歩いて　島を　見たい",
		ask: [
			"島って、飛べば\nすぐ　なんだけど〜",
			"歩いて　見て　みたいの〜。\n……ひとりだと、迷子に　なりそう〜",
		],
		join: "フェリスが　ぱたぱた　ついてきた。",
		line: "島、いっしょに　歩こ〜。\n……飛ばないで　行って　みたいの〜",
		lineCue: { emote: "♪" },
		thanks: [
			"歩いて　見る　島、\nきれいだった〜",
			"おかえり、言う　係なのに\n言われちゃった〜。……お礼〜",
		],
		thanksCue: { emote: "花" },
		reward: 300,
	},
	{
		id: "ngoane_tako",
		who: "ngoane",
		board: "konamono",
		goal: 6,
		title: "弟の　好物さがし",
		ask: [
			"弟の　好きな　たこ焼き、\nおんたこに　あるンゴねぇ……",
			"ひとりは　こわいンゴ……。\n6階まで、いっしょに　来てンゴ",
		],
		join: "ンゴ姉が　エプロンの　まま　ついてきた。",
		line: "弟の　好物、さがすンゴねぇ。\n……たのむンゴ",
		thanks: [
			"ソースの　におい、\n持って　帰ってきたンゴ",
			"弟には、ないしょンゴねぇ。\n……お礼ンゴ",
		],
		reward: 400,
	},
	{
		id: "nichie_matsuri",
		who: "nichie",
		board: "festival",
		goal: 6,
		title: "日曜日みたいな　祭り",
		ask: [
			"お祭りの　板、\n毎日　日曜日みたいニィ？",
			"見て　みたいニィ……。\nでも　ひとりは　月曜日みたいニィ",
		],
		join: "にぃちぇが　うきうきで　ついてきた。",
		line: "お祭り、行くニィ！\n……今日は　日曜日ってことに　するニィ",
		lineCue: { gesture: "hop" },
		thanks: [
			"日曜日、見てきたニィ！",
			"……月曜日も、ちょっとだけ\n好きに　なったニィ。お礼ニィ",
		],
		thanksCue: { emote: "♪" },
		reward: 400,
	},
	{
		id: "zero_tower",
		who: "zero",
		board: "deep",
		goal: 10,
		title: "投票箱の　あった　所",
		ask: [
			"投票箱の　しずんでた　所、\nゼロも　見て　みたいんです",
			"……ひとりだと、数えまちがえ\nそうで。10階まで、いっしょに",
		],
		join: "ゼロが　かけよってきた。",
		line: "ゼロも　行きます。\n……近くで　数えたいんです",
		lineCue: { emote: "!" },
		thanks: [
			"見てきました。\n来年の　票も、ここに　しずむんですね",
			"ちゃんと　数えました。\n……お礼、です",
		],
		reward: 500,
	},
	{
		id: "hinary_hinan",
		who: "hinary",
		board: "hinan",
		goal: 8,
		title: "避難Jの　現地調査",
		ask: [
			"避難Jを　現地調査したいと\n思います",
			"……ひとりでは　心細い\n模様です。8階まで、同行を",
		],
		join: "ヒナリーが　メモを　かかえて　ついてきた。",
		line: "現地調査を　開始したいと\n思います",
		thanks: [
			"調査の　結果、\n避難Jは　しずかでした",
			"これで　発表を　終わりたいと\n思います。……お礼です",
		],
		reward: 500,
	},
	{
		id: "shobon_ato",
		who: "shobon",
		board: "ato",
		goal: 10,
		title: "跡地を　もう一度",
		ask: [
			"跡地、もう一度\n見て　おきたいんだ",
			"……ひとりだと、\nちょっと　さびしくて",
		],
		join: "原住民が　梯子の　前で　待っていた。",
		line: "……のんびり　行こうよ。\n10階まで",
		thanks: [
			"……見てきた。\nなんにも　かわってなかった",
			"それで　いいんだ。\n……お礼、少しだけど",
		],
		reward: 500,
	},
];

export const escortById = (
	id: string | null | undefined,
): EscortRequest | null => ESCORTS.find((e) => e.id === id) ?? null;

/** 仲間（Speaker）の 依頼主か（住人なら false）。 */
const isFriend = (who: GuestId): who is GuestId & Speaker => who in CAST;

/** 依頼主が いま 村に いるか（仲間は 越してきて いて 出ていって いない・住人は 越してきている）。 */
export const requesterHere = (
	who: GuestId,
	cleared: readonly DungeonId[],
	stage: number,
	points: number,
): boolean =>
	isFriend(who)
		? !awayFriends(cleared, stage).includes(who)
		: movedIn(townStep(stage, points), cleared).includes(who as MobId);

/** 掲示板に 出ている 依頼（持ち帰った 板・依頼主が 村に いる・まだ はたして いない。順は ESCORTS）。 */
export const openEscorts = (
	cleared: readonly DungeonId[],
	stage: number,
	points: number,
	done: readonly string[],
): EscortRequest[] =>
	ESCORTS.filter(
		(e) =>
			!done.includes(e.id) &&
			cleared.includes(e.board) &&
			(!e.need || cleared.includes(e.need)) &&
			requesterHere(e.who, cleared, stage, points),
	);

/**
 * この 冒険に ついてくる 同行者（引き受けた 依頼の 板へ 出る ときだけ。主人公と 同じ 人・村に いない 人は 来ない）。
 */
export const escortFor = (
	d: DungeonId,
	accepted: string | null,
	cleared: readonly DungeonId[],
	stage: number,
	points: number,
	hero: HeroId,
): EscortRequest | null => {
	const e = escortById(accepted);
	if (!e || e.board !== d) return null;
	if (e.who === hero) return null;
	if (!requesterHere(e.who, cleared, stage, points)) return null;
	return e;
};

/** 冒険に 渡す 形。 */
export const escortSpec = (e: EscortRequest): GuestSpec => ({
	id: e.who,
	goal: e.goal,
});

/** 同行者の 歩行グラ（仲間は 村と 同じ・住人は data/people/mobs.ts の 絵）。 */
export const guestWalk = (id: GuestId): string =>
	isFriend(id) ? CAST[id].walk : MOBS[id as MobId].sprite;

/** 同行者が 話す ときの 名前欄・色・立ち絵（村の 窓と 同じ）。 */
export const guestVoice = (
	id: GuestId,
): {
	name: string;
	color: string;
	portrait: {
		id: string;
		name: string;
		color: string;
		src: string;
		side: "left" | "right";
	} | null;
} => {
	if (isFriend(id)) {
		const c = CAST[id];
		return {
			name: c.label ?? c.name,
			color: c.color,
			portrait: c.portrait
				? { id, name: c.name, color: c.color, ...c.portrait }
				: null,
		};
	}
	const m = MOBS[id as MobId];
	const color = m.color ?? "#e8e0c8";
	return {
		name: m.label ?? m.name,
		color,
		portrait: m.portrait
			? { id, name: m.name, color, src: m.portrait, side: "right" }
			: null,
	};
};

/** 依頼主が 仲間なら その Speaker（村の 窓で say。住人なら null：sayAs）。 */
export const speakerOf = (who: GuestId): Speaker | null =>
	isFriend(who) ? who : null;

/** まとめ掲示板の 文（ui/village/villageEvents.ts の escortBoardScript）。 */
export const ESCORT_MSG = {
	/** 掲示板の メニューの 1行。 */
	menu: "同行の　依頼",
	/** 一覧の 題（{n} は 出ている 数）。 */
	list: "同行の　依頼　{n}件",
	/** 新しい 依頼が 出ている（掲示板を 調べた とき 1回）。 */
	pinned: "掲示板に、はり紙が　ふえている。\n……同行の　依頼。",
	/** はり紙を 読む（{name} は 依頼主）。 */
	head: "{name}の　字で　書いてある。",
	choose: ["引き受ける", "やめる"],
	/** 引き受けている 依頼の 選択肢。 */
	chooseAccepted: ["このまま", "とりやめる"],
	/** {board} は 板の 名前、{name} は 依頼主。 */
	accepted: "依頼を　引き受けた。\n{board}へ　行くとき、{name}が　ついてくる。",
	dropped: "依頼を　とりやめた。",
	/** ほかの 依頼を 引き受けている とき。 */
	swap: "ほかの　依頼を　引き受けている。\n……こちらに　かえる？",
	/** 引き受けている 依頼の 印（一覧の 小さい 説明）。 */
	mark: "引き受けている",
	/** 依頼主 本人が 主人公で 出た（{name}。同じ 人は 2人 いない：依頼は そのまま）。 */
	self: "{name}が　自分で　行くので、\n同行の　依頼は　また　こんど。",
	/** お礼（{yen}）。 */
	reward: "お礼に　{yen}　もらった。",
} as const;

/** 依頼主の 名前（はり紙の 一覧）。 */
export const requesterName = (who: GuestId): string => guestVoice(who).name;

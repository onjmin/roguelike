// 同行の 依頼（2026-10-14 作者：「一人じゃ 心細いけど 見に行きたい」「ポケダンの 依頼も 参考に」「本筋で 毎回 同行を
// 要求されるのは くどいので、寄り道程度で」）。
// - 村の まとめ掲示板に はり紙で 出る（村の 機能は 物に。ui/village/villageEvents.ts の boardScript）。引き受けるかは 選ぶ。
// - 依頼は 持ち帰った ことの ある 板だけ（本筋の 山場の 冒険には ついてこない）。1つずつ 引き受ける。
// - 引き受けた あと その 板へ 出ると、依頼主が ついてくる（core/guest.ts）。見たかった 階に 着くと 満足して 村へ 帰り、
//   帰ってきた キリコに お礼（少しの お金）。たおれたら 依頼は そのまま（また 行ける）。
// - 依頼主が 村に まだ いない・冒険に 出る 主人公（ロゼ・ゼロ）と 同じ 人なら、その 冒険には ついてこない。
// やきうは 依頼しない（名無しの 一人。掲示板を 見るので いそがしい）。

import type { HeroId } from "../../core/data/heroes";
import type { DungeonId, GuestId, GuestSpec } from "../../core/types";
import type { Cue } from "../../engine/emote";
import type { Speaker } from "../story/quotes";
import { awayFriends } from "../story/story";
import { CAST } from "./cast";
import { awayMobs, MOB_IDS, MOBS, type MobId } from "./mobs";

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
		goal: 4,
		title: "本家の視察",
		ask: [
			"パン板の本家を\n視察したい",
			"……出張所の者がひとりで\n行くのは、部下に示しがつかん",
		],
		join: "パン松がパンをかかえてついてきた。",
		line: "視察だ。\n……手荒なまねはしない",
		thanks: [
			"本家は、まだパンの\nにおいがした",
			"……パンを食え。\nそれと、礼だ",
		],
		reward: 300,
	},
	{
		id: "roze_kinoko",
		who: "roze",
		board: "kinoko",
		goal: 4,
		title: "むかし来た板",
		ask: [
			"むかし来たきのこ板、\nもう一度見たいアル",
			"……ひとりは心細いアル。\n4階まで、いっしょに来てほしいアル",
		],
		join: "ロゼが鍋を置いてついてきた。",
		line: "きのこ板、ひさしぶりアル。\n……案内はいらないアル",
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
		title: "湯治のつきそい",
		ask: [
			"……べ、べつに湯治に\n行きたいわけじゃないわよ",
			"でも、ひとりはちょっと……。\n8階まで、つきあいなさいよ",
		],
		join: "シヨがタオルをかかえてついてきた。",
		line: "……湯治よ、湯治。\nあなたはついでよ",
		lineCue: { emote: "汗" },
		thanks: [
			"……いいお湯だったわ。\nべ、べつに楽しかったわけじゃ……",
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
		title: "歩いて島を見たい",
		ask: [
			"島って、飛べば\nすぐなんだけど〜",
			"歩いて見てみたいの〜。\n……ひとりだと、迷子になりそう〜",
		],
		join: "フェリスがぱたぱたついてきた。",
		line: "島、いっしょに歩こ〜。\n……飛ばないで行ってみたいの〜",
		lineCue: { emote: "♪" },
		thanks: [
			"歩いて見る島、\nきれいだった〜",
			"ステージなしで歩くの、\nはじめてだった〜。……お礼〜",
		],
		thanksCue: { emote: "花" },
		reward: 300,
	},
	{
		id: "ngoane_tako",
		who: "ngoane",
		board: "konamono",
		goal: 6,
		title: "弟の好物さがし",
		ask: [
			"弟の好きなたこ焼き、\nおんたこにあるンゴねぇ……",
			"ひとりはこわいンゴ……。\n6階まで、いっしょに来てンゴ",
		],
		join: "ンゴ姉がエプロンのままついてきた。",
		line: "弟の好物、さがすンゴねぇ。\n……たのむンゴ",
		thanks: [
			"ソースのにおい、\n持って帰ってきたンゴ",
			"弟には、ないしょンゴねぇ。\n……お礼ンゴ",
		],
		reward: 400,
	},
	{
		id: "nichie_matsuri",
		who: "nichie",
		board: "festival",
		goal: 6,
		title: "日曜日みたいな祭り",
		ask: [
			"お祭りの板、\n毎日日曜日みたいニィ？",
			"見てみたいニィ……。\nでもひとりは月曜日みたいニィ",
		],
		join: "にぃちぇがうきうきでついてきた。",
		line: "お祭り、行くニィ！\n……今日は日曜日ってことにするニィ",
		lineCue: { gesture: "hop" },
		thanks: [
			"日曜日、見てきたニィ！",
			"……月曜日も、ちょっとだけ\n好きになったニィ。お礼ニィ",
		],
		thanksCue: { emote: "♪" },
		reward: 400,
	},
	{
		id: "zero_tower",
		who: "zero",
		board: "deep",
		goal: 10,
		title: "主電源のあった所",
		ask: [
			"町の主電源があった所、\nゼロも見てみたいんです",
			"……ひとりだと、数えまちがえ\nそうで。10階まで、いっしょに",
		],
		join: "ゼロがかけよってきた。",
		line: "ゼロも行きます。\n……近くで数えたいんです",
		lineCue: { emote: "!" },
		thanks: [
			"見てきました。\nレスは、ここに積もるんですね",
			"ちゃんと数えました。\n……お礼、です",
		],
		reward: 500,
	},
];

export const escortById = (
	id: string | null | undefined,
): EscortRequest | null => ESCORTS.find((e) => e.id === id) ?? null;

/** 仲間（Speaker）の 依頼主か（住人なら false）。 */
const isFriend = (who: GuestId): who is GuestId & Speaker => who in CAST;

/** 依頼主が いま 村に いるか（仲間も 住人も、板の 話が 片づいて 帰ってきて から）。 */
export const requesterHere = (
	who: GuestId,
	cleared: readonly DungeonId[],
	_stage: number,
	_points: number,
): boolean =>
	isFriend(who)
		? !awayFriends(cleared).includes(who)
		: MOB_IDS.includes(who as MobId) &&
			!awayMobs(cleared).includes(who as MobId);

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
/**
 * 板の 人（目的が deliver・bring の 同行者。core/data/dungeons.ts）。絵は その 板の 敵の 歩行グラを 借りる。
 */
export const STORY_GUESTS: Partial<
	Record<GuestId, { name: string; sprite: string; color: string }>
> = {
	islander: {
		name: "島民",
		sprite: "pub:sprites/natsuko.png",
		color: "#9ad8c8",
	},
	oyabun: {
		name: "祭りの親分",
		sprite: "pub:sprites/mashii.png",
		color: "#f0b070",
	},
};

export const guestWalk = (id: GuestId): string =>
	STORY_GUESTS[id]?.sprite ??
	(isFriend(id) ? CAST[id].walk : MOBS[id as MobId].sprite);

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
	const story = STORY_GUESTS[id];
	if (story) return { name: story.name, color: story.color, portrait: null };
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
	menu: "同行の依頼",
	/** 一覧の 題（{n} は 出ている 数）。 */
	list: "同行の依頼　{n}件",
	/** 新しい 依頼が 出ている（掲示板を 調べた とき 1回）。 */
	pinned: "掲示板に、はり紙がふえている。\n……同行の依頼。",
	/** はり紙を 読む（{name} は 依頼主）。 */
	head: "{name}の字で書いてある。",
	choose: ["引き受ける", "やめる"],
	/** 引き受けている 依頼の 選択肢。 */
	chooseAccepted: ["このまま", "とりやめる"],
	/** {board} は 板の 名前、{name} は 依頼主。 */
	accepted: "依頼を引き受けた。\n{board}へ行くとき、{name}がついてくる。",
	dropped: "依頼をとりやめた。",
	/** ほかの 依頼を 引き受けている とき。 */
	swap: "ほかの依頼を引き受けている。\n……こちらにかえる？",
	/** 引き受けている 依頼の 印（一覧の 小さい 説明）。 */
	mark: "引き受けている",
	/** 依頼主 本人が 主人公で 出た（{name}。同じ 人は 2人 いない：依頼は そのまま）。 */
	self: "{name}が自分で行くので、\n同行の依頼はまたこんど。",
	/** お礼（{yen}）。 */
	reward: "お礼に{yen}もらった。",
} as const;

/** 依頼主の 名前（はり紙の 一覧）。 */
export const requesterName = (who: GuestId): string => guestVoice(who).name;

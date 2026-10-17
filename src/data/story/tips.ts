// おんJタウンの 子が ときどき 教えてくれる 小ネタ（説明文だけでは 気づきにくい 組み合わせ・しくみ）。
// 説明文を なぞるのでは なく、一歩 応用した 使いかたを 書く。
// いつもの ひとことの かわりに、まれに 出る（ui/village/villageMobs.ts）。見た 小ネタは くり返さない。
// 地の文で「〜が　スレで　見た　小ネタを　教えてくれた」の あと、ここの 窓を 出す
// （子ごとの 口ぐせに 寄せずに すむよう、書きこみの 引用の 形にする）。
// 1窓は 全角22字・2行まで。中身は core の しくみと 合わせる（かえたら ここも）。

import type { MobCtx } from "../people/mobs";

export type Tip = {
	key: string;
	lines: readonly string[];
	/** 合う 帰りにだけ（unlocked は 開いた 板）。無ければ いつでも。 */
	when?: (x: MobCtx, unlocked: readonly string[]) => boolean;
};

export const TIPS: readonly Tip[] = [
	{
		// core/run.ts の tickHunger と 自然回復
		key: "glutton_diet",
		lines: [
			"「◆大食いにダイエット板をあわせると、\nおなかはふつうにへるだけ」",
			"「そのくせHPは2倍はやくもどる」",
		],
	},
	{
		// core/effects.ts（草は 飲めば 満腹 +5）
		key: "herb_food",
		lines: [
			"「正体のわからない草でも、\n飲めばおなかがすこしふくれる」",
			"「見分けるために飲むのも、\nりっぱなごはん」",
		],
	},
	{
		key: "return_hunger",
		lines: ["「持ち帰る品をひろったら、\n帰り道はおなかがへらない」"],
	},
	{
		key: "empty_regen",
		lines: ["「おなかが空っぽだと、\nじっとしていてもHPはもどらない」"],
	},
	{
		key: "throw_bad_herb",
		lines: [
			"「飲むとこまる草ほど、\n投げると敵によく効く」",
			"「寝落ち草・安価草・アク禁草……\n捨てる前に投げてみる」",
		],
	},
	{
		// コピペの杖は ボス いがいなら メタルぷゆゆも ふえる（core/run.ts の splitMonster）
		key: "split_metal",
		lines: [
			"「コピペの杖をメタルぷゆゆに振ると、\n経験値のかたまりが2匹になる」",
		],
	},
	{
		// 祭り（モンスターハウス）に 入っても 起きない（core/run.ts）
		key: "sage_house",
		lines: ["「◆sage進行なら、祭りの部屋に\n入ってもだれも起きない」"],
	},
	{
		// 飯テロスレは 装備中の 物も えらべて、パンに なると 外れる（core/effects.ts の s_bread）
		key: "meshi_curse",
		lines: [
			"「のろわれて外せない装備も、\n飯テロスレでパンにすれば外れる」",
			"「お祓いスレがなくても、\nおなかはふくれる」",
		],
	},
	// ───── 隠し要素の うわさ（見つける 前に ほのめかす） ─────
	{
		// core/data/monsters.ts の metal（ダメージは 1まで・HP3・忍法帖の実を 落とす）
		key: "metal_rumor",
		lines: [
			"「深い階にまれに、ぴかぴかの\nぷゆゆが出るらしい」",
			"「どんな一撃も1しか通らない。\nでもHPは3しかない」",
			"「たおせば経験値がどっさり。\n忍法帖の実も落とす」",
		],
	},
	{
		// 論破の杖は ボス いがいを 一撃（core/effects.ts の w_rebut）。会った あとの 応用
		key: "rebut_metal",
		when: (x) => x.seen.includes("metal"),
		lines: ["「メタルぷゆゆには、論破の杖。\nかならず当たって一撃」"],
	},
	{
		// !skスレは 晒し草を 飲んだ 階でだけ 見える（core/item.ts の invisible）
		key: "gacha",
		lines: [
			"「晒し草を飲んだ階では、ふだん\n見えないスレが床に見えることも」",
			"「!skスレ。何が出るかは\nスレ主しだい」",
		],
	},
	{
		// 安価の罠の お題を こなすと 正体つきの 道具（core/anka.ts の ankaHit）
		key: "anka",
		lines: [
			"「安価の罠を踏んだら、お題をこなす。\nできれば神安価」",
			"「スレ民が正体のわかった道具を\n置いていってくれる」",
		],
	},
	{
		// 敵が 道具を かかえて いる（core/floor.ts の CARRY_CHANCE。たおすと 落とす）
		key: "carry",
		lines: ["「敵が道具をかかえていることが\nある。たおせば落とす」"],
	},
	{
		// 過去ログの底は 電池板（deep）を クリアすると 開く。開く まで だけ
		key: "well",
		when: (_, unlocked) => !unlocked.includes("hidden"),
		lines: [
			"「広場の古井戸、底が見えないって。\n電池板の底まで行けばわかるとか」",
		],
	},
];

/** いつもの ひとことの かわりに 小ネタが 出る 割合。 */
export const TIP_CHANCE = 1 / 4;

export const TIP_LEAD = "{name}が、スレで見た\n小ネタを教えてくれた。";

// 保守村の 子が ときどき 教えてくれる 小ネタ（説明文だけでは 気づきにくい 組み合わせ・しくみ）。
// 説明文を なぞるのでは なく、一歩 応用した 使いかたを 書く。
// いつもの ひとことの かわりに、まれに 出る（ui/villageMobs.ts）。見た 小ネタは くり返さない。
// 地の文で「〜が　スレで　見た　小ネタを　教えてくれた」の あと、ここの 窓を 出す
// （子ごとの 口ぐせに 寄せずに すむよう、書きこみの 引用の 形にする）。
// 1窓は 全角22字・2行まで。中身は core の しくみと 合わせる（かえたら ここも）。

import type { MobCtx } from "./mobs";

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
			"「◆大食いに　ダイエット板を　あわせると、\nおなかは　ふつうに　へるだけ」",
			"「そのくせ　HPは　2倍　はやく　もどる」",
		],
	},
	{
		// core/effects.ts（草は 飲めば 満腹 +5）
		key: "herb_food",
		lines: [
			"「正体の　わからない　草でも、\n飲めば　おなかが　すこし　ふくれる」",
			"「見分けるために　飲むのも、\nりっぱな　ごはん」",
		],
	},
	{
		key: "return_hunger",
		lines: ["「持ち帰る　品を　ひろったら、\n帰り道は　おなかが　へらない」"],
	},
	{
		key: "empty_regen",
		lines: ["「おなかが　空っぽだと、\nじっと　していても　HPは　もどらない」"],
	},
	{
		key: "throw_bad_herb",
		lines: [
			"「飲むと　こまる　草ほど、\n投げると　敵に　よく　効く」",
			"「寝落ち草・安価草・アク禁草……\n捨てる　前に　投げてみる」",
		],
	},
	{
		// 重複の杖は ボス いがいなら メタルぷゆゆも ふえる（core/run.ts の splitMonster）
		key: "split_metal",
		lines: [
			"「重複の杖を　メタルぷゆゆに　振ると、\n経験値の　かたまりが　2匹に　なる」",
		],
	},
	{
		// 祭り（モンスターハウス）に 入っても 起きない（core/run.ts）
		key: "sage_house",
		lines: ["「◆sage進行なら、祭りの　部屋に\n入っても　だれも　起きない」"],
	},
	{
		// 飯テロスレは 装備中の 物も えらべて、パンに なると 外れる（core/effects.ts の s_bread）
		key: "meshi_curse",
		lines: [
			"「のろわれて　外せない　装備も、\n飯テロスレで　パンに　すれば　外れる」",
			"「お祓いスレが　なくても、\nおなかは　ふくれる」",
		],
	},
	// ───── 隠し要素の うわさ（見つける 前に ほのめかす） ─────
	{
		// core/data/monsters.ts の metal（ダメージは 1まで・HP3・忍法帖の実を 落とす）
		key: "metal_rumor",
		lines: [
			"「深い　階に　まれに、ぴかぴかの\nぷゆゆが　出るらしい」",
			"「どんな　一撃も　1しか　通らない。\nでも　HPは　3しか　ない」",
			"「たおせば　経験値が　どっさり。\n忍法帖の実も　落とす」",
		],
	},
	{
		// 論破の杖は ボス いがいを 一撃（core/effects.ts の w_rebut）。会った あとの 応用
		key: "rebut_metal",
		when: (x) => x.seen.includes("metal"),
		lines: ["「メタルぷゆゆには、論破の杖。\nかならず　当たって　一撃」"],
	},
	{
		// !skスレは 晒し草を 飲んだ 階でだけ 見える（core/item.ts の invisible）
		key: "gacha",
		lines: [
			"「晒し草を　飲んだ　階では、ふだん\n見えない　スレが　床に　見える　ことも」",
			"「!skスレ。何が　出るかは\nスレ主しだい」",
		],
	},
	{
		// 安価の罠の お題を こなすと 正体つきの 道具（core/anka.ts の ankaHit）
		key: "anka",
		lines: [
			"「安価の罠を　踏んだら、お題を　こなす。\nできれば　神安価」",
			"「スレ民が　正体の　わかった　道具を\n置いていってくれる」",
		],
	},
	{
		// 敵が 道具を かかえて いる（core/floor.ts の CARRY_CHANCE。たおすと 落とす）
		key: "carry",
		lines: ["「敵が　道具を　かかえて　いる　ことが\nある。たおせば　落とす」"],
	},
	{
		// 裏ルートの おーぷぬ（乗っ取り屋は 持ち物を 乗っ取る。忍法帖の実が 床に 落ちている）。開いてから だけ
		key: "opunu",
		when: (_, unlocked) => unlocked.includes("opunu"),
		lines: [
			"「諸島の　乗っ取り屋は、持ち物を\n乗っ取って　逃げる。たおせば　もどる」",
			"「あの　板では　忍法帖の実が　床に\n落ちてる　ことも。レベルが　上がる」",
		],
	},
	{
		// 過去ログの底は 電池板（deep）を クリアすると 開く。開く まで だけ
		key: "well",
		when: (_, unlocked) => !unlocked.includes("hidden"),
		lines: [
			"「広場の　古井戸、底が　見えないって。\n電池板の　底まで　行けば　わかるとか」",
		],
	},
];

/** いつもの ひとことの かわりに 小ネタが 出る 割合。 */
export const TIP_CHANCE = 1 / 4;

export const TIP_LEAD = "{name}が、スレで　見た\n小ネタを　教えてくれた。";

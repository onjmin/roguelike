// 保守村の 子が ときどき 教えてくれる 小ネタ（説明文だけでは 気づきにくい 組み合わせ・しくみ）。
// いつもの ひとことの かわりに、まれに 出る（ui/villageMobs.ts）。見た 小ネタは くり返さない。
// 地の文で「〜が　スレで　見た　小ネタを　教えてくれた」の あと、ここの 窓を 出す
// （子ごとの 口ぐせに 寄せずに すむよう、書きこみの 引用の 形にする）。
// 1窓は 全角22字・2行まで。中身は core の しくみと 合わせる（かえたら ここも）。

export type Tip = { key: string; lines: readonly string[] };

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
		key: "full_herb",
		lines: [
			"「HPが　満タンの　ときに　草を　飲むと、\n最大HPが　すこし　ふえる」",
		],
	},
	{
		key: "throw_bad_herb",
		lines: [
			"「飲むと　こまる　草ほど、\n投げると　敵に　よく　効く」",
			"「寝落ち草・安価草・アク禁草……\n捨てる　前に　投げてみる」",
		],
	},
	{
		key: "ronpa_next",
		lines: [
			"「論破の杖は　いつも　回数0で　見つかる。\n次スレで　ふやせば　一撃の　杖」",
		],
	},
	{
		// 祭り（モンスターハウス）に 入っても 起きない（core/run.ts）
		key: "sage_house",
		lines: ["「◆sage進行なら、祭りの　部屋に\n入っても　だれも　起きない」"],
	},
	{
		key: "meshi_tero",
		lines: [
			"「飯テロスレは　道具を　パンに　変える。\nいらない　物が　食べものに　なる」",
		],
	},
	{
		key: "escape_goal",
		lines: [
			"「帰還スレは、持ち帰る　品を\n持っていると　きかない」",
			"「品を　ひろう　前に　読むか、\n歩いて　帰るか」",
		],
	},
];

/** いつもの ひとことの かわりに 小ネタが 出る 割合。 */
export const TIP_CHANCE = 1 / 4;

export const TIP_LEAD = "{name}が、スレで　見た\n小ネタを　教えてくれた。";

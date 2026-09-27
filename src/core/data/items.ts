// 道具の定義と、出かたの表（トルネコ1と同じく 階ごとに 重みで引く）。
//
// トルネコ1（不思議・もっと不思議）の顔ぶれと数値に寄せ、DQ の固有名は使わない。
// 説明文は一覧の2行目に出るので、単語の間を全角スペースで区切る（折り返しの位置になる）。

import type { ItemWeight } from "../itemTable";
import type { ItemCat, ItemDef } from "../types";

const defs: ItemDef[] = [];
let order = 0;
const add = (d: Omit<ItemDef, "order">): void => {
	defs.push({ ...d, order: order++ });
};

// ───────── 武器（強さ。修正値は装備か識別でわかる） ─────────
add({
	id: "club",
	cat: "weapon",
	sound: { swing: "swing_blunt", hit: "hit_club" },
	name: "ぬるぽ棒",
	atk: 1,
	desc: "木を　けずった　ぬるい棒",
	flavor: "ぬるぽと　書けば　ガッと　返る。ネットで　いちばん　たしかな　因果",
});
add({
	id: "copper",
	cat: "weapon",
	sound: { swing: "swing_blade", hit: "hit_copper" },
	name: "名無しの剣",
	atk: 3,
	desc: "ありふれた　剣。名無しさんの　標準装備",
	flavor: "だれもが　持っていて、だれも　おぼえていない",
});
add({
	id: "bat",
	cat: "weapon",
	sound: { swing: "swing_blunt", hit: "hit_bat" },
	name: "ガッのバット",
	atk: 4,
	desc: "よく　しなる　バット。ぬるぽに　ガッ",
	flavor:
		"ぬるぽが　なければ　ただの　バット。生きがいを　他人に　あずけている",
});
add({
	id: "wyrmbane",
	cat: "weapon",
	sound: { swing: "swing_blade", hit: "hit_wyrm" },
	name: "ワイ断ちの剣",
	atk: 5,
	desc: "竜（ワイ　バーン）には　ダメージが　2倍",
	flavor: "竜も　ワイも　ぶった切る。自分語りの　多い　スレに　1本　ほしい",
});
add({
	id: "steel",
	cat: "weapon",
	sound: { swing: "swing_blade", hit: "hit_steel" },
	name: "コテハンの剣",
	atk: 6,
	desc: "よく　切れる　剣。名無しより　一段上",
	flavor: "名前を　出した　ぶん　強い。そして　たたかれやすい",
});
add({
	id: "starsword",
	cat: "weapon",
	sound: { swing: "swing_blade", hit: "hit_star" },
	name: "降臨の剣",
	atk: 7,
	desc: "空から　降臨した　鉄の剣",
	flavor: "降臨は　一瞬、ログは　永遠",
});
add({
	id: "mic",
	cat: "weapon",
	sound: { swing: "swing_blunt", hit: "hit_mic" },
	name: "ネ申マイク",
	atk: 10,
	desc: "スタンドごと　振る。いちばん　重くて　いちばん　強い",
	flavor: "歌うより　なぐる　ほうが　得意な　マイク",
});

// ───────── 盾 ─────────
add({
	id: "leather",
	cat: "shield",
	name: "ダイエット板",
	def: 2,
	desc: "うすい　板。錆びない。おなかが　へりにくい",
	flavor: "この板の　住人は、だいたい　明日から　本気を　出す",
});
add({
	id: "bronze",
	cat: "shield",
	name: "雑談板",
	def: 3,
	desc: "ありふれた　板",
	flavor: "話題は　なんでも　いい。ただし　かならず　脱線する",
});
add({
	id: "scale",
	cat: "shield",
	name: "スルー板",
	def: 4,
	desc: "毒で　ちからを　下げられない（荒らしは　スルー）",
	flavor: "「スルーしろ」と　書きこむ　人が、いちばん　スルー　できていない",
});
add({
	id: "mirror",
	cat: "shield",
	name: "永久保存板",
	def: 5,
	desc: "錆びない（永久保存版）",
	flavor: "【永久保存版】と　ついた　スレほど、すぐ　落ちる",
});
add({
	id: "steelsh",
	cat: "shield",
	name: "鉄板",
	def: 6,
	desc: "かたい　板。守りは　鉄板",
	flavor: "鉄板ネタも　3回目には　寒い",
});
add({
	id: "fireward",
	cat: "shield",
	name: "火消し板",
	def: 7,
	desc: "炎の　ダメージが　半分（炎上の　火消し）",
	flavor: "火消しが　来ると、だいたい　もっと　燃える",
});
add({
	id: "starshield",
	cat: "shield",
	name: "ネ申板",
	def: 10,
	desc: "空から　降臨した　鉄の板",
	flavor: "ネ申は　降臨する　たびに、ハードルが　上がる",
});

// ───────── 指輪（未識別） ─────────
add({
	id: "r_might",
	cat: "ring",
	name: "◆筋肉",
	desc: "ちからが　3　上がる（のろいなら　下がる）",
	flavor: "筋肉は　裏切らない。のろわれて　いなければ",
});
add({
	id: "r_sustain",
	cat: "ring",
	name: "◆腹いっぱい",
	desc: "おなかが　へらない",
	flavor: "もう　おなか　いっぱい。この　ネタも",
});
add({
	id: "r_hunger",
	cat: "ring",
	name: "◆大食い",
	desc: "おなかが　2倍　へる",
	flavor: "ダンジョンより　先に、食費で　力つきる",
});
add({
	id: "r_trap",
	cat: "ring",
	name: "◆釣られない",
	desc: "罠に　かからない",
	flavor: "釣られない　自信の　ある　人ほど、よく　釣れる",
});
add({
	id: "r_awake",
	cat: "ring",
	name: "◆徹夜",
	desc: "眠らなくなる",
	flavor: "寝ないのでは　ない。寝られないだけ",
});
add({
	id: "r_purity",
	cat: "ring",
	name: "◆スルースキル",
	desc: "ちからを　下げられない",
	flavor: "ほんとうに　持っている　人は、持っていると　わざわざ　言わない",
});
add({
	id: "r_stealth",
	cat: "ring",
	name: "◆sage進行",
	desc: "眠っている　敵が　起きない",
	flavor: "しずかに　書けば　だれも　起こさない。だれも　読まない　とも　言う",
});
add({
	id: "r_clamor",
	cat: "ring",
	name: "◆全力age",
	desc: "眠っている　敵が　すぐ起きる",
	flavor: "上げれば　人が　来る。来てほしくない　人も",
});
add({
	id: "r_ward",
	cat: "ring",
	name: "◆保守",
	desc: "レベルや　最大HPを　下げられない",
	flavor: "保守しか　書かれない　スレでも、落ちるよりは　まし",
});

// ───────── 草・実（未識別） ─────────
add({
	id: "h_heal",
	cat: "herb",
	name: "草",
	desc: "HPが　25　回復（満タンなら　最大HP＋1）",
	flavor: "草。それ以上でも　それ以下でも　ない",
});
add({
	id: "h_greater",
	cat: "herb",
	name: "大草原",
	desc: "HPが　100　回復（満タンなら　最大HP＋2）",
	flavor: "笑いすぎて　傷も　ふさがる。不可避",
});
add({
	id: "h_poison",
	cat: "herb",
	name: "荒らし草",
	desc: "HPが　5　へり、ちからが　3　下がる",
	flavor: "荒らしは　まず　自分を　きずつける",
});
add({
	id: "h_might",
	cat: "herb",
	name: "プロテイン草",
	desc: "ちからが　1　上がる",
	flavor: "飲んだだけで　強くなった　気が　する。気のせい　ではない",
});
add({
	id: "h_growth",
	cat: "herb",
	name: "忍法帖の実",
	desc: "めったに　ない　実。レベルが　1　上がる",
	flavor: "毎日　書きこむ　だけで　レベルが　上がる。人生にも　ほしい",
	// メタルぷゆゆの 落とし物。はじめから 正体が わかり、見た目も 専用
	rare: true,
});
add({
	id: "h_swift",
	cat: "herb",
	name: "ksk草",
	desc: "しばらく　倍速で　動ける",
	flavor: "いくら　急いでも、スレは　1000で　終わる",
});
add({
	id: "h_blind",
	cat: "herb",
	// おーぷんの スレ主コマンド !aku。アク禁されると スレが 見えない。投げれば 敵を アク禁（とくぎも 封じる）
	name: "アク禁草",
	desc: "アク禁されて　何も　見えなくなる。投げると　敵を　アク禁する",
	flavor: "見えない。書けない。でも　反省は　しない",
});
add({
	id: "h_blink",
	cat: "herb",
	// おーぷんの スレ主コマンド !バルス（スレごと 消して 逃げる。「バルスして逃亡」）
	name: "バルス草",
	desc: "この階の　どこかへ　跳ぶ",
	flavor: "都合が　悪くなったら　ぜんぶ　消して　逃げる。ラピュタより　手軽",
});
add({
	id: "h_reel",
	cat: "herb",
	// 安価で 動きを 決められて 思いどおりに 動けない
	name: "安価草",
	desc: "安価に　ふりまわされる（混乱）。投げると　敵を　混乱させる",
	flavor: "自分の　人生を、他人の　レスに　まかせた　結果",
});
add({
	// トルネコ1の まどわし草（頭お花畑）
	id: "h_daze",
	cat: "herb",
	name: "お花畑草",
	desc: "まどわされる（敵が　自分の姿に、道具が　お花に　見える）。投げると　敵が　逃げだす",
	flavor: "世界が　やさしく　見える。見えている　だけ",
});
add({
	id: "h_sleep",
	cat: "herb",
	name: "寝落ち草",
	desc: "眠ってしまう。投げると　敵を　眠らせる",
	flavor: "「ちょっと　横に　なるだけ」が　いちばん　あぶない",
});
add({
	id: "h_antidote",
	cat: "herb",
	// おんJの「このスレが上がってるの見たら水分補給しろ」。弱ったのが もとに もどる
	name: "水分補給草",
	desc: "下がった　ちからが　元にもどる",
	flavor: "スレを　見て　水を　飲む。それだけで　立ちなおれる　のが　人間",
});
add({
	id: "h_fire",
	cat: "herb",
	name: "燃料投下草",
	desc: "前に　炎を　吐く（足元の道具も　燃える）",
	flavor: "消火の　ふりを　して　燃料を　まく　人が、いちばん　燃やす",
});
add({
	id: "h_sight",
	cat: "herb",
	name: "晒し草",
	desc: "この階の　見えない敵が　見える。アク禁も　とける",
	flavor: "晒す　ほうも、だいたい　晒されている",
});

// ───────── スレ（巻物にあたる。未識別） ─────────
add({
	id: "s_appraise",
	cat: "scroll",
	name: "有識者スレ",
	desc: "有識者ニキが　道具を　1つ　識別する",
	flavor: "呼べば　かならず　有識者ニキが　来る。ここだけ　ネットより　優秀",
});
add({
	id: "s_whet",
	cat: "scroll",
	name: "腹筋スレ",
	desc: "装備中の　武器が　＋1。のろいも　とける",
	flavor: "IDの　数字が　小さいことを　いのる",
});
add({
	id: "s_temper",
	cat: "scroll",
	name: "耐久スレ",
	desc: "装備中の　板が　＋1。のろいも　とける",
	flavor: "耐えた　先に　なにが　あるかは、耐えた　人も　知らない",
});
add({
	id: "s_uncurse",
	cat: "scroll",
	name: "お祓いスレ",
	desc: "装備の　のろいを　とく",
	flavor: "意味が　あるかは　スレで　もめる。効くのは　たしか",
});
add({
	id: "s_rustproof",
	cat: "scroll",
	name: "延命スレ",
	desc: "装備中の　板が　錆びなくなる",
	flavor: "終わるべき　ものを　終わらせない　技術",
});
add({
	id: "s_map",
	cat: "scroll",
	name: "聖地巡礼スレ",
	desc: "この階の　地形と　罠が　わかる",
	flavor: "現地に　行っても、アニメの　人は　いない",
});
add({
	id: "s_sense",
	cat: "scroll",
	name: "ヲチスレ",
	desc: "この階の　敵の　いる所が　わかる",
	flavor: "見ている　つもりで、見られている",
});
add({
	id: "s_treasure",
	cat: "scroll",
	name: "発掘スレ",
	desc: "この階の　道具の　ある所が　わかる",
	flavor: "掘りだした　ものが　黒歴史で　ある　確率は　高い",
});
add({
	id: "s_hold",
	cat: "scroll",
	name: "凍結スレ",
	desc: "まわりの　敵が　動けなくなる",
	flavor: "凍結の　理由は、だいたい　教えて　もらえない",
});
add({
	id: "s_blast",
	cat: "scroll",
	name: "炎上スレ",
	desc: "部屋じゅうの　敵に　ダメージ",
	flavor: "燃えている　ときが、いちばん　人が　多い",
});
add({
	id: "s_ward",
	cat: "scroll",
	name: "避難所スレ",
	desc: "床に　置くと　そこが　避難所になる（読んでも　効かない）。その上では　となりから　なぐられない。置くと　拾えない",
	flavor: "避難所は　本スレより　平和。ただし　過疎",
});
add({
	id: "s_recharge",
	cat: "scroll",
	name: "次スレ",
	desc: "杖を　1本　えらんで　回数を　ふやす",
	flavor: "次スレを　立てた　人は　えらい。えらい　だけ",
});
add({
	id: "s_bread",
	cat: "scroll",
	name: "飯テロスレ",
	desc: "道具を　1つ　えらんで　ぷゆゆパンに　変える",
	flavor: "深夜2時には、なんでも　パンに　見えてくる",
});
add({
	id: "s_snare",
	cat: "scroll",
	name: "釣りスレ",
	desc: "この階に　罠が　ふえる",
	flavor: "釣りだと　わかっていても、釣られに　行くのが　住人",
});
add({
	id: "s_escape",
	cat: "scroll",
	name: "帰還スレ",
	desc: "読むと　その場で　地上へ　もどる。持ち帰る品を　持っていると　きかない",
	flavor: "帰還報告に「で？」と　返すまでが　様式美",
});

// ───────── 杖（未識別。前に魔法の弾を撃つ。投げて 当てても 効く（回数0でも。当たった 杖は なくなる）） ─────────
add({
	id: "w_bolt",
	cat: "staff",
	name: "フルボッコの杖",
	charges: [6, 9],
	desc: "敵に　20　前後の　ダメージ（かならず　当たる）",
	flavor: "1人を　みんなで　たたくと、みんな　正義の　顔に　なる",
});
add({
	id: "w_reel",
	cat: "staff",
	name: "安価の杖",
	charges: [4, 6],
	desc: "敵を　混乱させる",
	flavor: "安価は　絶対。だれが　決めたかは　知らない",
});
add({
	id: "w_sleep",
	cat: "staff",
	name: "寝落ちの杖",
	charges: [3, 6],
	desc: "敵を　眠らせる",
	flavor: "おやすみの　ひとことも　なく、ふっと　消える",
});
add({
	id: "w_seal",
	cat: "staff",
	name: "規制の杖",
	charges: [5, 8],
	desc: "敵の　とくぎを　封じる",
	flavor: "規制に　文句を　言いたくても、規制されて　いて　言えない",
});
add({
	id: "w_change",
	cat: "staff",
	name: "改変の杖",
	charges: [3, 6],
	desc: "敵を　ほかの　敵に　変える",
	flavor: "元ネタより　おもしろく　なったら　勝ち",
});
add({
	id: "w_send",
	cat: "staff",
	name: "隔離の杖",
	charges: [3, 5],
	desc: "敵を　この階の　どこかへ　飛ばす",
	flavor: "隔離スレは　なぜか　本スレより　伸びる",
});
add({
	id: "w_slow",
	cat: "staff",
	name: "ラグの杖",
	charges: [3, 5],
	desc: "敵を　鈍足にする",
	flavor: "おそいのは　回線か、自分の　反応か",
});
add({
	id: "w_edge",
	cat: "staff",
	name: "諸刃の杖",
	charges: [3, 5],
	desc: "自分の　HPが　半分になり、敵の　HPが　1になる",
	flavor: "相手を　追いつめる　かわりに、自分も　あやうい。レスバと　同じ",
});
add({
	id: "w_split",
	cat: "staff",
	name: "重複の杖",
	charges: [3, 5],
	desc: "敵が　2匹に　ふえる",
	flavor: "重複スレは、どっちを　使うかで　まず　もめる",
});
add({
	id: "w_haste",
	cat: "staff",
	name: "kskの杖",
	charges: [3, 6],
	desc: "敵が　倍速になる",
	flavor: "kskしたいのは　スレで　あって、敵では　ない",
});

// ───────── 矢（束。投げると1本ずつ飛ぶ） ─────────
add({
	id: "a_wood",
	cat: "arrow",
	name: "煽りの矢",
	atk: 4,
	desc: "軽い　ひとこと。撃つと　1本ずつ　飛ぶ。外れた矢は　ひろえる",
	flavor: "軽く　撃った　つもりが、重く　返ってくる",
});
add({
	id: "a_iron",
	cat: "arrow",
	name: "正論の矢",
	atk: 12,
	desc: "ぐうの音も　出ない　一撃。撃つと　1本ずつ　飛ぶ。外れた矢は　ひろえる",
	flavor: "正しい　ことを　言うと、なぜか　嫌われる",
});

// ───────── 食べもの ─────────
add({
	id: "f_bread",
	cat: "food",
	name: "片親パン",
	desc: "満腹度が　50　回復",
	flavor: "安くて　でかい。それが　すべてで、それで　いい",
});
add({
	id: "f_large",
	cat: "food",
	name: "ぷゆゆパン",
	desc: "満腹度が　100　回復",
	flavor: "ぷゆゆが　焼いた　わけでは　ない。たぶん",
});
add({
	id: "f_moldy",
	cat: "food",
	name: "チギュリパン",
	desc: "満腹度が　100　回復。ちからが　1　下がり、HPも　へる",
	flavor: "食べた　あとの　むなしさ　まで　セット",
});

// ───────── 目的の品（床には出ない） ─────────
add({
	id: "genban",
	cat: "goal",
	name: "はじまりの原盤",
	desc: "いちばん底に　あった　レコード。持ち帰ろう",
	flavor: "すべての　はじまり。持ち帰るまでが　冒険",
});
add({
	id: "needle",
	cat: "goal",
	name: "蓄音機の針",
	desc: "ちょっと下に　落ちていた　針。持ち帰ろう",
	flavor: "針が　なければ、レコードは　ただの　黒い　円盤",
});
add({
	id: "tsuzuki",
	cat: "goal",
	name: "つづきの原盤",
	desc: "底の　さらに　下の　レコード。まだ、なにも　入っていない",
	flavor: "つづきは　まだ　書かれて　いない。書くのは　たぶん　きみ",
});

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(
	defs.map((d) => [d.id, d]),
);
export const ITEM_LIST: readonly ItemDef[] = defs;

export const itemsOfCat = (cat: ItemCat): ItemDef[] =>
	defs.filter((d) => d.cat === cat);

/**
 * 本編（過去ログの底）の 道具の出かた（重み）。重みの合計 164 は、1回の冒険（27階）で 出る数の 目安。
 * トルネコ1の 不思議のダンジョン 27階で 拾える量に合わせた：床に 5〜7個 × ゴールドでない率 196/256 で 27階 ≈ 124、
 * 祭り（1回の冒険で 約1.6回 × 10〜15個）≈ 15、落とし物 10〜20 で、およそ 150〜160。
 * 分け方は トルネコ1の カテゴリの率（/256：草87・巻物74・武器20・盾20・パン19・矢16・指輪10・杖10）に寄せた。
 * ほかのダンジョンの表は data/dungeons.ts。
 */
export const MAIN_ITEMS: readonly ItemWeight[] = [
	// 武器 12
	{ kind: "club", weight: 2 },
	{ kind: "copper", weight: 3 },
	{ kind: "bat", weight: 2 },
	{ kind: "wyrmbane", weight: 1 },
	{ kind: "steel", weight: 2 },
	{ kind: "starsword", weight: 1 },
	{ kind: "mic", weight: 1 },
	// 盾 12
	{ kind: "leather", weight: 2 },
	{ kind: "bronze", weight: 3 },
	{ kind: "scale", weight: 2 },
	{ kind: "mirror", weight: 1 },
	{ kind: "steelsh", weight: 2 },
	{ kind: "fireward", weight: 1 },
	{ kind: "starshield", weight: 1 },
	// 指輪 10
	{ kind: "r_might", weight: 2 },
	{ kind: "r_sustain", weight: 1 },
	{ kind: "r_hunger", weight: 1 },
	{ kind: "r_trap", weight: 1 },
	{ kind: "r_awake", weight: 1 },
	{ kind: "r_purity", weight: 1 },
	{ kind: "r_stealth", weight: 1 },
	{ kind: "r_clamor", weight: 1 },
	{ kind: "r_ward", weight: 1 },
	// 草・実 51
	{ kind: "h_heal", weight: 11 },
	{ kind: "h_greater", weight: 5 },
	{ kind: "h_poison", weight: 3 },
	{ kind: "h_might", weight: 5 },
	{ kind: "h_growth", weight: 1 },
	{ kind: "h_swift", weight: 2 },
	{ kind: "h_blind", weight: 3 },
	{ kind: "h_blink", weight: 5 },
	{ kind: "h_reel", weight: 3 },
	{ kind: "h_daze", weight: 2 },
	{ kind: "h_sleep", weight: 3 },
	{ kind: "h_antidote", weight: 3 },
	{ kind: "h_fire", weight: 3 },
	{ kind: "h_sight", weight: 2 },
	// スレ 42
	{ kind: "s_appraise", weight: 9 },
	{ kind: "s_whet", weight: 4 },
	{ kind: "s_temper", weight: 4 },
	{ kind: "s_uncurse", weight: 2 },
	{ kind: "s_rustproof", weight: 2 },
	{ kind: "s_map", weight: 4 },
	{ kind: "s_sense", weight: 2 },
	{ kind: "s_treasure", weight: 2 },
	{ kind: "s_hold", weight: 3 },
	{ kind: "s_blast", weight: 3 },
	{ kind: "s_ward", weight: 1 },
	{ kind: "s_recharge", weight: 2 },
	{ kind: "s_bread", weight: 2 },
	{ kind: "s_snare", weight: 2 },
	// 帰還 3（リレミトにあたる。読むと その場で地上へ。持ちこみ・倉庫に つながる）
	{ kind: "s_escape", weight: 3 },
	// 杖 10
	{ kind: "w_bolt", weight: 1 },
	{ kind: "w_reel", weight: 1 },
	{ kind: "w_sleep", weight: 1 },
	{ kind: "w_seal", weight: 1 },
	{ kind: "w_change", weight: 1 },
	{ kind: "w_send", weight: 1 },
	{ kind: "w_slow", weight: 1 },
	{ kind: "w_edge", weight: 1 },
	{ kind: "w_split", weight: 1 },
	{ kind: "w_haste", weight: 1 },
	// 矢 9
	{ kind: "a_wood", weight: 6 },
	{ kind: "a_iron", weight: 3 },
	// 食べもの 15
	{ kind: "f_bread", weight: 11 }, // 出る数が ばらつくので、山札のころの 9 より多め
	{ kind: "f_large", weight: 4 }, // 出る数が ばらつくので、山札のころの 3 より多め
	{ kind: "f_moldy", weight: 3 },
];

/** カテゴリの表示名（図鑑の見出し）。 */
export const CAT_NAME: Record<ItemCat, string> = {
	weapon: "武器",
	shield: "板",
	ring: "トリップ",
	herb: "草",
	scroll: "スレ",
	staff: "杖",
	arrow: "矢",
	food: "メシ",
	goal: "目的の品",
};

// 道具の定義と山札（1回の冒険で出る道具の、中身の決まった束）。
//
// トルネコ1（不思議・もっと不思議）の顔ぶれと数値に寄せ、DQ の固有名は使わない。
// 説明文は一覧の2行目に出るので、単語の間を全角スペースで区切る（折り返しの位置になる）。

import type { DeckEntry } from "../deck";
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
	origin: "2chで「ぬるぽ」と　書くと「ガッ」と　たたかれる　お約束から",
});
add({
	id: "copper",
	cat: "weapon",
	sound: { swing: "swing_blade", hit: "hit_copper" },
	name: "名無しの剣",
	atk: 3,
	desc: "ありふれた　剣。名無しさんの　標準装備",
	origin: "2chで　名前を　書かずに　書きこむと　出る「名無しさん」から",
});
add({
	id: "bat",
	cat: "weapon",
	sound: { swing: "swing_blunt", hit: "hit_bat" },
	name: "ガッのバット",
	atk: 4,
	desc: "よく　しなる　バット。ぬるぽに　ガッ",
	origin: "「ぬるぽ」に「ガッ」と　返して　なぐる　お約束の　音から",
});
add({
	id: "wyrmbane",
	cat: "weapon",
	sound: { swing: "swing_blade", hit: "hit_wyrm" },
	name: "ワイ断ちの剣",
	atk: 5,
	desc: "竜（ワイ　バーン）には　ダメージが　2倍",
	origin:
		"なんJ・おんJの　一人称「ワイ」と　竜の「ワイバーン」を　かけた　しゃれ",
});
add({
	id: "steel",
	cat: "weapon",
	sound: { swing: "swing_blade", hit: "hit_steel" },
	name: "コテハンの剣",
	atk: 6,
	desc: "よく　切れる　剣。名無しより　一段上",
	origin: "名前を　つけて　書きこむ　常連「コテハン（固定ハンドル）」から",
});
add({
	id: "starsword",
	cat: "weapon",
	sound: { swing: "swing_blade", hit: "hit_star" },
	name: "降臨の剣",
	atk: 7,
	desc: "空から　降臨した　鉄の剣",
	origin:
		"うわさの　本人が　スレに　あらわれる「降臨」から（おんJでも「おんjにワイ降臨」）",
});
add({
	id: "mic",
	cat: "weapon",
	sound: { swing: "swing_blunt", hit: "hit_mic" },
	name: "ネ申マイク",
	atk: 10,
	desc: "スタンドごと　振る。いちばん　重くて　いちばん　強い",
	origin:
		"「神」を　ネと申に　分けて　書く　2chの「ネ申」と、蓄音キリコの　マイクから",
});

// ───────── 盾 ─────────
add({
	id: "leather",
	cat: "shield",
	name: "ダイエット板",
	def: 2,
	desc: "うすい　板。錆びない。おなかが　へりにくい",
	origin: "2chに　あった「ダイエット板」から（おなかが　へりにくい）",
});
add({
	id: "bronze",
	cat: "shield",
	name: "雑談板",
	def: 3,
	desc: "ありふれた　板",
	origin: "どこの　掲示板にも　ある　ふつうの「雑談板」から",
});
add({
	id: "scale",
	cat: "shield",
	name: "スルー板",
	def: 4,
	desc: "毒で　ちからを　下げられない（荒らしは　スルー）",
	origin: "「荒らしは　スルー」の　心得から（荒らしの　毒が　効かない）",
});
add({
	id: "mirror",
	cat: "shield",
	name: "永久保存板",
	def: 5,
	desc: "錆びない（永久保存版）",
	origin: "スレタイに　つく「【永久保存版】」を　板に　かけた　しゃれ",
});
add({
	id: "steelsh",
	cat: "shield",
	name: "鉄板",
	def: 6,
	desc: "かたい　板。守りは　鉄板",
	origin: "「まちがいない」の　意味の「鉄板」と　鉄の　板を　かけて",
});
add({
	id: "fireward",
	cat: "shield",
	name: "火消し板",
	def: 7,
	desc: "炎の　ダメージが　半分（炎上の　火消し）",
	origin:
		"炎上を　しずめに　来る「火消し」から（おんJでも「おんJに火消しが来てる」）",
});
add({
	id: "starshield",
	cat: "shield",
	name: "ネ申板",
	def: 10,
	desc: "空から　降臨した　鉄の板",
	origin: "2chで「神」を　2文字に　分けて　書いた「ネ申」から",
});

// ───────── 指輪（未識別） ─────────
add({
	id: "r_might",
	cat: "ring",
	name: "◆筋肉",
	desc: "ちからが　3　上がる（のろいなら　下がる）",
	origin:
		"名前の　うしろに　つく　本人の　しるし「◆トリップ」に、筋トレ民の「筋肉」を　のせた",
});
add({
	id: "r_sustain",
	cat: "ring",
	name: "◆腹いっぱい",
	desc: "おなかが　へらない",
	origin:
		"本人の　しるし「◆トリップ」に、飯テロにも　負けない「腹いっぱい」を　のせた",
});
add({
	id: "r_hunger",
	cat: "ring",
	name: "◆大食い",
	desc: "おなかが　2倍　へる",
	origin: "本人の　しるし「◆トリップ」に「大食い」を　のせた（飯テロに　弱い）",
});
add({
	id: "r_trap",
	cat: "ring",
	name: "◆釣られない",
	desc: "罠に　かからない",
	origin: "うそで　ひっかける「釣り」に　釣られない、から",
});
add({
	id: "r_awake",
	cat: "ring",
	name: "◆徹夜",
	desc: "眠らなくなる",
	origin:
		"夜通し　起きている「徹夜」から（おんJでも「今日は徹夜する？」の　スレが　立つ）",
});
add({
	id: "r_purity",
	cat: "ring",
	name: "◆スルースキル",
	desc: "ちからを　下げられない",
	origin: "煽りや　荒らしを　受け流す「スルースキル」から",
});
add({
	id: "r_stealth",
	cat: "ring",
	name: "◆sage進行",
	desc: "眠っている　敵が　起きない",
	origin:
		"メール欄に　sageと　入れて　スレを　上げずに　書く「sage進行」から（おんJにも【sage進行】スレが　ある）",
});
add({
	id: "r_clamor",
	cat: "ring",
	name: "◆全力age",
	desc: "眠っている　敵が　すぐ起きる",
	origin: "スレを　一覧の　上に　上げる「age」を　全力で、から",
});
add({
	id: "r_ward",
	cat: "ring",
	name: "◆保守",
	desc: "レベルや　最大HPを　下げられない",
	origin: "スレが　落ちないように　書きこむ「保守」から",
});

// ───────── 草・実（未識別） ─────────
add({
	id: "h_heal",
	cat: "herb",
	name: "草",
	desc: "HPが　25　回復（満タンなら　最大HP＋1）",
	origin: "笑いを　あらわす「w」が　草に　見えることから",
});
add({
	id: "h_greater",
	cat: "herb",
	name: "大草原",
	desc: "HPが　100　回復（満タンなら　最大HP＋2）",
	origin: "草が　生えまくるほど　笑う「大草原不可避」から",
});
add({
	id: "h_poison",
	cat: "herb",
	name: "荒らし草",
	desc: "HPが　5　へり、ちからが　3　下がる",
	origin: "スレを　めちゃくちゃに　する「荒らし」から",
});
add({
	id: "h_might",
	cat: "herb",
	name: "プロテイン草",
	desc: "ちからが　1　上がる",
	origin:
		"筋トレ民の　お供「プロテイン」から（おんJでも「今日もソイプロテイン」）",
});
add({
	id: "h_growth",
	cat: "herb",
	name: "忍法帖の実",
	desc: "めったに　ない　実。レベルが　1　上がる",
	origin: "おーぷんで　毎日　書きこむと　レベルが　上がる「忍法帖」から",
	// メタルぷゆゆの 落とし物。はじめから 正体が わかり、見た目も 専用
	rare: true,
});
add({
	id: "h_swift",
	cat: "herb",
	name: "ksk草",
	desc: "しばらく　倍速で　動ける",
	origin:
		"「加速」を　ローマ字の　頭文字で　書いた「ksk」から（kskst＝加速しろ）",
});
add({
	id: "h_blind",
	cat: "herb",
	// おーぷんの スレ主コマンド !aku。アク禁されると スレが 見えない。投げれば 敵を アク禁（とくぎも 封じる）
	name: "アク禁草",
	desc: "アク禁されて　何も　見えなくなる。投げると　敵を　アク禁する",
	origin:
		"おーぷんの　スレ主コマンド「!aku」で　アク禁されると　書きこめず、運営の　アク禁なら　ページも　見られなくなる、から",
});
add({
	id: "h_blink",
	cat: "herb",
	// おーぷんの スレ主コマンド !バルス（スレごと 消して 逃げる。「バルスして逃亡」）
	name: "バルス草",
	desc: "この階の　どこかへ　跳ぶ",
	origin:
		"おーぷんの　スレ主コマンド「!バルス」で　スレごと　消して　逃げる　ことから（元は　ラピュタの　滅びの　呪文）",
});
add({
	id: "h_reel",
	cat: "herb",
	// 安価で 動きを 決められて 思いどおりに 動けない
	name: "安価草",
	desc: "安価に　ふりまわされる（混乱）。投げると　敵を　混乱させる",
	origin:
		"「>>10が　決める」のように、ほかの　人の　レス（安価）で　動きを　決められる　スレから",
});
add({
	// トルネコ1の まどわし草（頭お花畑）
	id: "h_daze",
	cat: "herb",
	name: "お花畑草",
	desc: "まどわされる（敵が　自分の姿に、道具が　お花に　見える）。投げると　敵が　逃げだす",
	origin: "考えが　甘すぎる　人を　からかう「頭お花畑」から",
});
add({
	id: "h_sleep",
	cat: "herb",
	name: "寝落ち草",
	desc: "眠ってしまう。投げると　敵を　眠らせる",
	origin: "書きこむ　とちゅうで　ねむってしまう「寝落ち」から",
});
add({
	id: "h_antidote",
	cat: "herb",
	// おんJの「このスレが上がってるの見たら水分補給しろ」。弱ったのが もとに もどる
	name: "水分補給草",
	desc: "下がった　ちからが　元にもどる",
	origin:
		"おんJで　続いている「このスレが上がってるの見たら水分補給しろ」スレから",
});
add({
	id: "h_fire",
	cat: "herb",
	name: "燃料投下草",
	desc: "前に　炎を　吐く（足元の道具も　燃える）",
	origin: "炎上を　さらに　あおる　ネタを　出す「燃料投下」から",
});
add({
	id: "h_sight",
	cat: "herb",
	name: "晒し草",
	desc: "この階の　見えない敵が　見える。アク禁も　とける",
	origin: "人の　書きこみや　正体を　さらす「晒し」から",
});

// ───────── スレ（巻物にあたる。未識別） ─────────
add({
	id: "s_appraise",
	cat: "scroll",
	name: "有識者スレ",
	desc: "有識者ニキが　道具を　1つ　識別する",
	origin: "くわしい　人を　呼ぶ「有識者ニキ　来てくれ」の　スレから",
});
add({
	id: "s_whet",
	cat: "scroll",
	name: "腹筋スレ",
	desc: "装備中の　武器が　＋1。のろいも　とける",
	origin: "IDの　数だけ　腹筋する「ID腹筋スレ」から",
});
add({
	id: "s_temper",
	cat: "scroll",
	name: "耐久スレ",
	desc: "装備中の　板が　＋1。のろいも　とける",
	origin: "年越しや　クリスマスまで　スレで　ねばる「耐久スレ」から",
});
add({
	id: "s_uncurse",
	cat: "scroll",
	name: "お祓いスレ",
	desc: "装備の　のろいを　とく",
	origin:
		"おんJにも　立つ「お祓いって意味あんの？」のような　お祓いの　スレから",
});
add({
	id: "s_rustproof",
	cat: "scroll",
	name: "延命スレ",
	desc: "装備中の　板が　錆びなくなる",
	origin: "スレを　長もち　させる「延命」から",
});
add({
	id: "s_map",
	cat: "scroll",
	name: "聖地巡礼スレ",
	desc: "この階の　地形と　罠が　わかる",
	origin: "アニメの　舞台を　めぐる「聖地巡礼」の　スレから",
});
add({
	id: "s_sense",
	cat: "scroll",
	name: "ヲチスレ",
	desc: "この階の　敵の　いる所が　わかる",
	origin: "人や　スレを　見はって　楽しむ「ヲチ（ウォッチ）」から",
});
add({
	id: "s_treasure",
	cat: "scroll",
	name: "発掘スレ",
	desc: "この階の　道具の　ある所が　わかる",
	origin:
		"昔の　絵や　画像を　掘りだして　貼る「発掘」から（おんJでも「昔のワイの絵発掘した」）",
});
add({
	id: "s_hold",
	cat: "scroll",
	name: "凍結スレ",
	desc: "まわりの　敵が　動けなくなる",
	origin: "アカウントを　止められる「凍結」から",
});
add({
	id: "s_blast",
	cat: "scroll",
	name: "炎上スレ",
	desc: "部屋じゅうの　敵に　ダメージ",
	origin: "何かが　燃えて　スレが　あれる「炎上」から",
});
add({
	id: "s_ward",
	cat: "scroll",
	name: "避難所スレ",
	desc: "床に　置くと　そこが　避難所になる（読んでも　効かない）。その上では　となりから　なぐられない。置くと　拾えない",
	origin: "スレが　使えないときに　にげこむ「避難所」から",
});
add({
	id: "s_recharge",
	cat: "scroll",
	name: "次スレ",
	desc: "杖を　1本　えらんで　回数を　ふやす",
	origin: "スレが　1000に　なったら　立てる「次スレ」から",
});
add({
	id: "s_bread",
	cat: "scroll",
	name: "飯テロスレ",
	desc: "道具を　1つ　えらんで　ぷゆゆパンに　変える",
	origin: "夜中に　うまそうな　メシの　画像を　貼る「飯テロ」から",
});
add({
	id: "s_snare",
	cat: "scroll",
	name: "釣りスレ",
	desc: "この階に　罠が　ふえる",
	origin: "うそで　人を　ひっかける「釣りスレ」から",
});
add({
	id: "s_escape",
	cat: "scroll",
	name: "帰還スレ",
	desc: "読むと　その場で　地上へ　もどる。持ち帰る品を　持っていると　きかない",
	origin: "「【朗報】ワイ、〜から帰還」のような、帰ってきた　報告スレから",
});

// ───────── 杖（未識別。前に魔法の弾を撃つ。投げて 当てても 効く（回数0でも。当たった 杖は なくなる）） ─────────
add({
	id: "w_bolt",
	cat: "staff",
	name: "フルボッコの杖",
	charges: [6, 9],
	desc: "敵に　20　前後の　ダメージ（かならず　当たる）",
	origin: "よってたかって　たたく「フルボッコ」から",
});
add({
	id: "w_reel",
	cat: "staff",
	name: "安価の杖",
	charges: [4, 6],
	desc: "敵を　混乱させる",
	origin: "スレの　なりゆきを　ほかの　人の　レスに　まかせる「安価」から",
});
add({
	id: "w_sleep",
	cat: "staff",
	name: "寝落ちの杖",
	charges: [3, 6],
	desc: "敵を　眠らせる",
	origin: "書きこみの　とちゅうで　力つきる「寝落ち」から",
});
add({
	id: "w_seal",
	cat: "staff",
	name: "規制の杖",
	charges: [5, 8],
	desc: "敵の　とくぎを　封じる",
	origin: "書きこみを　止められる「規制」（連投規制など）から",
});
add({
	id: "w_change",
	cat: "staff",
	name: "改変の杖",
	charges: [3, 6],
	desc: "敵を　ほかの　敵に　変える",
	origin: "コピペの　一部を　かえて　別の　話に　する「改変」から",
});
add({
	id: "w_send",
	cat: "staff",
	name: "隔離の杖",
	charges: [3, 5],
	desc: "敵を　この階の　どこかへ　飛ばす",
	origin: "困った　話題を　別の　スレに　とじこめる「隔離スレ」から",
});
add({
	id: "w_slow",
	cat: "staff",
	name: "ラグの杖",
	charges: [3, 5],
	desc: "敵を　鈍足にする",
	origin: "表示や　書きこみが　おくれる「ラグ」から",
});
add({
	id: "w_edge",
	cat: "staff",
	name: "諸刃の杖",
	charges: [3, 5],
	desc: "自分の　HPが　半分になり、敵の　HPが　1になる",
	origin:
		"自分も　きずつく「諸刃の剣」から（おんJでも「片親煽りって諸刃の剣」）",
});
add({
	id: "w_split",
	cat: "staff",
	name: "重複の杖",
	charges: [3, 5],
	desc: "敵が　2匹に　ふえる",
	origin: "同じ　スレが　2つ　立ってしまう「重複」から",
});
add({
	id: "w_haste",
	cat: "staff",
	name: "kskの杖",
	charges: [3, 6],
	desc: "敵が　倍速になる",
	origin: "「加速」の　ローマ字の　頭文字「ksk」から",
});

// ───────── 矢（束。投げると1本ずつ飛ぶ） ─────────
add({
	id: "a_wood",
	cat: "arrow",
	name: "煽りの矢",
	atk: 4,
	desc: "軽い　ひとこと。撃つと　1本ずつ　飛ぶ。外れた矢は　ひろえる",
	origin: "相手を　いらだたせる「煽り」レスから",
});
add({
	id: "a_iron",
	cat: "arrow",
	name: "正論の矢",
	atk: 12,
	desc: "ぐうの音も　出ない　一撃。撃つと　1本ずつ　飛ぶ。外れた矢は　ひろえる",
	origin: "言い返せない「正論」レスから（おんJでも「〜←ぶっちゃけ正論よな」）",
});

// ───────── 食べもの ─────────
add({
	id: "f_bread",
	cat: "food",
	name: "片親パン",
	desc: "満腹度が　50　回復",
	origin:
		"安くて　大きい　袋入りの　菓子パンを　からかう　ネットの　ことば「片親パン」から",
});
add({
	id: "f_large",
	cat: "food",
	name: "ぷゆゆパン",
	desc: "満腹度が　100　回復",
	origin:
		"おんJの　🥺キャラ　ぷゆゆの　パン（Googleの　サジェストにも　乗った）から",
});
add({
	id: "f_moldy",
	cat: "food",
	name: "チギュリパン",
	desc: "満腹度が　100　回復。ちからが　1　下がり、HPも　へる",
	origin:
		"「チー牛」と「片親パン」を　あわせた　ネットの　ことば「チギュりパン」から",
});

// ───────── 目的の品（山札には入らない） ─────────
add({
	id: "genban",
	cat: "goal",
	name: "はじまりの原盤",
	desc: "いちばん底に　あった　レコード。持ち帰ろう",
	origin:
		"レコードを　作るときの　もとの　盤「原盤」から（キリコは　おんJ生まれの「蓄音」キャラ）",
});
add({
	id: "needle",
	cat: "goal",
	name: "蓄音機の針",
	desc: "ちょっと下に　落ちていた　針。持ち帰ろう",
	origin: "レコードを　鳴らす　蓄音機の　針から（蓄音キリコの「蓄音」）",
});
add({
	id: "tsuzuki",
	cat: "goal",
	name: "つづきの原盤",
	desc: "底の　さらに　下の　レコード。まだ、なにも　入っていない",
	origin:
		"レコードを　作るときの　もとの　盤「原盤」の、まだ　何も　入っていない　つづき",
});

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(
	defs.map((d) => [d.id, d]),
);
export const ITEM_LIST: readonly ItemDef[] = defs;

export const itemsOfCat = (cat: ItemCat): ItemDef[] =>
	defs.filter((d) => d.cat === cat);

/**
 * 本編（過去ログの底）の山札の中身（毎回同じ。並びだけ冒険ごとに切る）。全164枚（帰還スレ 3枚を ふくむ）。
 * トルネコ1の 不思議のダンジョン 27階で 拾える量に合わせた：床に 5〜7個 × ゴールドでない率 196/256 で 27階 ≈ 124、
 * 祭り（1回の冒険で 約1.6回 × 10〜15個）≈ 15、落とし物 10〜20 で、およそ 150〜160。
 * 分け方は トルネコ1の カテゴリの率（/256：草87・巻物74・武器20・盾20・パン19・矢16・指輪10・杖10）に寄せ、
 * 指輪と杖は「数えて識別できる」ように 1種 1本以上で 10ずつ。
 * ほかのダンジョンの山札は data/dungeons.ts。
 */
export const MAIN_DECK: readonly DeckEntry[] = [
	// 武器 12
	{ kind: "club", count: 2 },
	{ kind: "copper", count: 3 },
	{ kind: "bat", count: 2 },
	{ kind: "wyrmbane", count: 1 },
	{ kind: "steel", count: 2 },
	{ kind: "starsword", count: 1 },
	{ kind: "mic", count: 1 },
	// 盾 12
	{ kind: "leather", count: 2 },
	{ kind: "bronze", count: 3 },
	{ kind: "scale", count: 2 },
	{ kind: "mirror", count: 1 },
	{ kind: "steelsh", count: 2 },
	{ kind: "fireward", count: 1 },
	{ kind: "starshield", count: 1 },
	// 指輪 10
	{ kind: "r_might", count: 2 },
	{ kind: "r_sustain", count: 1 },
	{ kind: "r_hunger", count: 1 },
	{ kind: "r_trap", count: 1 },
	{ kind: "r_awake", count: 1 },
	{ kind: "r_purity", count: 1 },
	{ kind: "r_stealth", count: 1 },
	{ kind: "r_clamor", count: 1 },
	{ kind: "r_ward", count: 1 },
	// 草・実 51
	{ kind: "h_heal", count: 11 },
	{ kind: "h_greater", count: 5 },
	{ kind: "h_poison", count: 3 },
	{ kind: "h_might", count: 5 },
	{ kind: "h_growth", count: 1 },
	{ kind: "h_swift", count: 2 },
	{ kind: "h_blind", count: 3 },
	{ kind: "h_blink", count: 5 },
	{ kind: "h_reel", count: 3 },
	{ kind: "h_daze", count: 2 },
	{ kind: "h_sleep", count: 3 },
	{ kind: "h_antidote", count: 3 },
	{ kind: "h_fire", count: 3 },
	{ kind: "h_sight", count: 2 },
	// スレ 42
	{ kind: "s_appraise", count: 9 },
	{ kind: "s_whet", count: 4 },
	{ kind: "s_temper", count: 4 },
	{ kind: "s_uncurse", count: 2 },
	{ kind: "s_rustproof", count: 2 },
	{ kind: "s_map", count: 4 },
	{ kind: "s_sense", count: 2 },
	{ kind: "s_treasure", count: 2 },
	{ kind: "s_hold", count: 3 },
	{ kind: "s_blast", count: 3 },
	{ kind: "s_ward", count: 1 },
	{ kind: "s_recharge", count: 2 },
	{ kind: "s_bread", count: 2 },
	{ kind: "s_snare", count: 2 },
	// 帰還 3（リレミトにあたる。読むと その場で地上へ。持ちこみ・倉庫に つながる）
	{ kind: "s_escape", count: 3 },
	// 杖 10
	{ kind: "w_bolt", count: 1 },
	{ kind: "w_reel", count: 1 },
	{ kind: "w_sleep", count: 1 },
	{ kind: "w_seal", count: 1 },
	{ kind: "w_change", count: 1 },
	{ kind: "w_send", count: 1 },
	{ kind: "w_slow", count: 1 },
	{ kind: "w_edge", count: 1 },
	{ kind: "w_split", count: 1 },
	{ kind: "w_haste", count: 1 },
	// 矢 9
	{ kind: "a_wood", count: 6 },
	{ kind: "a_iron", count: 3 },
	// 食べもの 15
	{ kind: "f_bread", count: 9 },
	{ kind: "f_large", count: 3 },
	{ kind: "f_moldy", count: 3 },
];

/** カテゴリの表示名（山札・図鑑の見出し）。 */
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

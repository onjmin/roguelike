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
	flavor:
		"ぬるい　棒。ぬるぽの　「ぬる」は　この棒から　来た　という　説を、いま　ワイが　考えた",
});
add({
	id: "copper",
	cat: "weapon",
	sound: { swing: "swing_blade", hit: "hit_copper" },
	name: "名無しの剣",
	atk: 3,
	desc: "ありふれた　剣。名無しさんの　標準装備",
	flavor: "累計　2億本　出荷。持ち主の　名前は　ぜんぶ　「風吹けば名無し」",
});
add({
	// たおれた あとの 支給品（engine/save.ts の giveRelief。ぷゆゆが 持ってくる）。強いが すぐ すり減る・ボスに 効かない・
	// 売っても 0（ふつうの 武器を 拾う 意味が なくならないように。作者の 指示。名前も 作者）
	id: "puyusword",
	cat: "weapon",
	sound: { swing: "swing_blade", hit: "hit_puyusword" },
	name: "ぷゆゆソード",
	atk: 35,
	// 正体が わかって いる 支給品なので 専用の 絵（🥺 の 柄頭。ui/art/itemArt.ts → scripts/make-items.mjs）
	icon: "pub:sprites/items/puyusword.png",
	relief: true,
	desc: "とても　強いが、なぐる　たびに　修正値が　1　へる（強さが　0に　なると　折れる）。ボスには　効かない。売っても　0",
	flavor: "ぷゆゆが　「つぎは　いけるぷゆ🥺」と　くれた。根拠は　🥺　だけ",
});
add({
	id: "bat",
	cat: "weapon",
	sound: { swing: "swing_blunt", hit: "hit_bat" },
	name: "ガッのバット",
	atk: 4,
	desc: "よく　しなる　バット。ぬるぽに　ガッ",
	flavor:
		"ぬるぽを　待って　20年。ガッする　相手が　来ないので、ふつうに　敵を　なぐっている",
});
add({
	id: "wyrmbane",
	cat: "weapon",
	sound: { swing: "swing_blade", hit: "hit_wyrm" },
	name: "ワイ断ちの剣",
	atk: 5,
	desc: "竜（ワイ　バーン）には　ダメージが　2倍",
	flavor:
		"竜と　ワイを　切る。「ワイ、　実は」で　始まる　レスを　見ると、勝手に　さやから　出る",
});
add({
	id: "steel",
	cat: "weapon",
	sound: { swing: "swing_blade", hit: "hit_steel" },
	name: "コテハンの剣",
	atk: 6,
	desc: "よく　切れる　剣。名無しより　一段上",
	flavor:
		"名無しより　1段　強い。かわりに　10年前の　書きこみを　ぜんぶ　掘られる",
});
add({
	id: "starsword",
	cat: "weapon",
	sound: { swing: "swing_blade", hit: "hit_star" },
	name: "降臨の剣",
	atk: 7,
	desc: "空から　降臨した　鉄の剣",
	flavor:
		"空から　降ってきた。降臨した　本人は　3レス　書いて　「落ちます」と　消えた",
});
add({
	id: "mic",
	cat: "weapon",
	sound: { swing: "swing_blunt", hit: "hit_mic" },
	name: "ネ申マイク",
	atk: 10,
	desc: "スタンドごと　振る。いちばん　重くて　いちばん　強い",
	flavor: "歌えば　神曲、振れば　鈍器。おんJで　評価されたのは　鈍器の　ほう",
});

// ───────── 盾 ─────────
add({
	id: "leather",
	cat: "shield",
	name: "ダイエット板",
	def: 2,
	desc: "うすい　板。錆びない。おなかが　へりにくい",
	flavor:
		"住人の　「明日から　本気」は、もう　5000日　連続で　更新　されている",
});
add({
	id: "bronze",
	cat: "shield",
	name: "雑談板",
	def: 3,
	desc: "ありふれた　板",
	flavor:
		"最初の　話題は　天気。10レス　後には　カレーの　具で　ケンカ　している",
});
add({
	id: "scale",
	cat: "shield",
	name: "スルー板",
	def: 4,
	desc: "毒で　ちからを　下げられない（荒らしは　スルー）",
	flavor:
		"「荒らしは　スルー」と　書いた　人が、そのあと　500レス　荒らしと　レスバ　している",
});
add({
	id: "mirror",
	cat: "shield",
	name: "永久保存板",
	def: 5,
	desc: "錆びない（永久保存版）",
	flavor:
		"錆びない。【永久保存版】と　書かれた　スレは、翌朝　ぜんぶ　落ちていた",
});
add({
	id: "steelsh",
	cat: "shield",
	name: "鉄板",
	def: 6,
	desc: "かたい　板。守りは　鉄板",
	flavor: "かたい。鉄板ネタも　かたい。3回目から　だれも　笑わないが、かたい",
});
add({
	id: "fireward",
	cat: "shield",
	name: "火消し板",
	def: 7,
	desc: "炎の　ダメージが　半分（炎上の　火消し）",
	flavor:
		"火消しが　来た　スレは　2倍　燃える。この板は　半分に　する。差し引き　いつもどおり",
});
add({
	id: "starshield",
	cat: "shield",
	name: "ネ申板",
	def: 10,
	desc: "空から　降臨した　鉄の板",
	flavor:
		"ネ申が　置いていった　板。次の　降臨は　「来週」と　書いたまま　14年",
});

// ───────── 指輪（未識別） ─────────
add({
	id: "r_might",
	cat: "ring",
	name: "◆筋肉",
	desc: "ちからが　3　上がる（のろいなら　下がる）",
	flavor:
		"筋肉は　裏切らない。のろわれて　いると、筋肉の　ほうから　辞表が　届く",
});
add({
	id: "r_sustain",
	cat: "ring",
	name: "◆腹いっぱい",
	desc: "おなかが　へらない",
	flavor: "食べなくても　平気。片親パンの　売り上げが、また　1つ　落ちる",
});
add({
	id: "r_hunger",
	cat: "ring",
	name: "◆大食い",
	desc: "おなかが　2倍　へるが、HPも　2倍　はやく　回復する",
	flavor: "傷は　2倍で　ふさがる。財布の　傷は　ふさがらない",
});
add({
	id: "r_trap",
	cat: "ring",
	name: "◆釣られない",
	desc: "罠に　かからない",
	flavor:
		"罠は　ふまない。スレの　釣りには　毎日　かかる。それは　また　べつの　話",
});
add({
	id: "r_awake",
	cat: "ring",
	name: "◆徹夜",
	desc: "眠らなくなる",
	flavor:
		"眠らない。朝5時の　スレで　「まだ　起きてる　やつ　おる？」と　聞きつづける",
});
add({
	id: "r_purity",
	cat: "ring",
	name: "◆スルースキル",
	desc: "ちからを　下げられない",
	flavor:
		"スルースキル　検定1級。合格通知も　スルー　したので、証明は　できない",
});
add({
	id: "r_stealth",
	cat: "ring",
	name: "◆sage進行",
	desc: "眠っている　敵が　起きない",
	flavor:
		"sageて　書けば　敵も　起きない。1年後、スレの　住人は　ワイ　1人に　なった",
});
add({
	id: "r_clamor",
	cat: "ring",
	name: "◆全力age",
	desc: "眠っている　敵が　すぐ起きる",
	flavor: "ageた　瞬間、部屋じゅうの　敵と、となりの　部屋の　おかんが　起きる",
});
add({
	id: "r_ward",
	cat: "ring",
	name: "◆保守",
	desc: "レベルや　最大HPを　下げられない",
	flavor:
		"レベルを　守る。「保守」だけで　1000まで　行った　スレも　ある。中身は　ない",
});
add({
	// トルネコの ルーラの指輪（元は ローグの テレポートの指輪）。スレを 巡回するように、ときどき 階の どこかへ 飛ぶ
	id: "r_patrol",
	cat: "ring",
	name: "◆巡回",
	desc: "ときどき　この階の　どこかへ　飛ばされる",
	flavor: "巡回　している　つもりが、気づけば　朝の　4時と　知らない　部屋",
});

// ───────── 草・実（未識別） ─────────
add({
	id: "h_heal",
	cat: "herb",
	name: "草",
	desc: "HPが　25　回復（満タンなら　最大HP＋1）",
	flavor: "飲むと　治る。食レポを　たのむと、「草」　とだけ　返ってくる",
});
add({
	id: "h_greater",
	cat: "herb",
	name: "大草原",
	desc: "HPが　100　回復（満タンなら　最大HP＋2）",
	flavor: "大草原　不可避。笑いすぎて　骨折まで　治った　という　報告が　3件",
});
add({
	id: "h_poison",
	cat: "herb",
	name: "荒らし草",
	desc: "HPが　5　へり（たおれは　しない）、ちからが　3　下がる",
	flavor:
		"ひと口で　ちからが　ぬける。荒らしの　気持ちが　わかる　草。わかりたくは　なかった",
});
add({
	id: "h_might",
	cat: "herb",
	name: "プロテイン草",
	desc: "ちからが　1　上がる",
	flavor:
		"原材料は　草　100％。どこに　たんぱく質が　あったのかは、メーカーも　知らない",
});
add({
	id: "h_growth",
	cat: "herb",
	name: "忍法帖の実",
	desc: "めったに　ない　実。レベルが　1　上がる",
	flavor:
		"毎日　書きこんで　3年　かかる　レベル上げを、ひと口で　すませる　背徳の　味",
	// メタルぷゆゆの 落とし物。はじめから 正体が わかり、見た目も 専用
	rare: true,
});
add({
	id: "h_swift",
	cat: "herb",
	name: "ksk草",
	desc: "しばらく　倍速で　動ける",
	flavor: "倍速で　動ける。kskしすぎて、スレタイを　読む　前に　1000が　来る",
});
add({
	id: "h_blind",
	cat: "herb",
	// おーぷんの スレ主コマンド !aku。アク禁されると スレが 見えない。投げれば 敵を アク禁（とくぎも 封じる）
	name: "アク禁草",
	desc: "アク禁されて　何も　見えなくなる（スレにも　書きこめない）。投げると　敵を　アク禁する",
	flavor:
		"見えない。書けない。反省も　しない。解除された　その日に　また　くらう",
});
add({
	id: "h_blink",
	cat: "herb",
	// どこかへ 飛ばされる「左遷」（おんJでも「北関東左遷ワイ、山田うどんに出会う」など）。
	// バルスは スレを 消して 逃げる ことで、跳ぶ ことでは ないので 使わない
	name: "左遷草",
	desc: "この階の　どこかへ　飛ばされる",
	flavor: "辞令：この階の　どこか。単身赴任。手当は　出ない",
});
add({
	id: "h_reel",
	cat: "herb",
	// 安価で 動きを 決められて 思いどおりに 動けない
	name: "安価草",
	desc: "安価に　ふりまわされる（混乱）。投げると　敵を　混乱させる",
	flavor:
		">>5が　「右」、>>6が　「左」と　言うので、ワイは　まっすぐ　壁に　ぶつかる",
});
add({
	// トルネコ1の まどわし草（頭お花畑）
	id: "h_daze",
	cat: "herb",
	name: "お花畑草",
	desc: "まどわされる（敵が　自分の姿に、道具が　お花に　見える）。投げると　敵が　逃げだす",
	flavor:
		"敵が　ぜんぶ　自分に　見える。なぐるか　迷って　いる　うちに　なぐられる",
});
add({
	id: "h_sleep",
	cat: "herb",
	name: "寝落ち草",
	desc: "眠ってしまう。投げると　敵を　眠らせる",
	flavor: "「ちょっと　横に　なるわ」　――　最後の　書きこみ（3日前）",
});
add({
	id: "h_antidote",
	cat: "herb",
	// おんJの「このスレが上がってるの見たら水分補給しろ」。弱ったのが もとに もどる
	name: "水分補給草",
	desc: "下がった　ちからが　元にもどる",
	flavor:
		"このスレが　上がって　いるのを　見たら　飲め。見て　いなくても　飲め",
});
add({
	id: "h_fire",
	cat: "herb",
	name: "燃料投下草",
	desc: "前に　炎を　吐く（足元の道具も　燃える）",
	flavor: "前が　燃える。本人は　「燃料を　置いた　だけ」と　供述　している",
});
add({
	id: "h_sight",
	cat: "herb",
	name: "晒し草",
	desc: "この階の　見えない敵と　見えない道具が　見える。アク禁も　とける",
	flavor:
		"見えない　ものが　ぜんぶ　見える。見なくて　よかった　ものも　ぜんぶ　見える",
});

// ───────── スレ（巻物にあたる。未識別） ─────────
add({
	id: "s_appraise",
	cat: "scroll",
	name: "有識者スレ",
	desc: "有識者ニキが　道具を　1つ　識別する",
	flavor:
		"有識者ニキ　到着まで　0.2秒。ふだん　何を　して　いるのかは、だれも　聞けない",
});
add({
	id: "s_whet",
	cat: "scroll",
	name: "腹筋スレ",
	desc: "装備中の　武器が　＋1。のろいも　とける",
	flavor:
		"IDの　数字の　ぶん　腹筋。出たのは　「9876」。ワイの　かわりに　武器が　鍛えられた",
});
add({
	id: "s_temper",
	cat: "scroll",
	name: "耐久スレ",
	desc: "装備中の　板が　＋1。のろいも　とける",
	flavor:
		"「1000まで　寝ない」　耐久スレ。住人は　ぜんいん　寝た。板だけが　耐えきった",
});
add({
	id: "s_uncurse",
	cat: "scroll",
	name: "お祓いスレ",
	desc: "装備の　のろいを　とく",
	flavor:
		"神主が　「祓った」と　1レス　書いて、ID　も　出さずに　帰った。のろいは　とけた",
});
add({
	id: "s_rustproof",
	cat: "scroll",
	name: "延命スレ",
	desc: "装備中の　板が　錆びなくなる",
	flavor:
		"終わるべき　ものを　終わらせない　技術。おんJの　半分は　これで　できている",
});
add({
	id: "s_map",
	cat: "scroll",
	name: "聖地巡礼スレ",
	desc: "この階の　地形と　罠が　わかる",
	flavor:
		"地形も　罠も　完璧に　わかる。肝心の　アニメの　人は　どこにも　いない",
});
add({
	id: "s_sense",
	cat: "scroll",
	name: "ヲチスレ",
	desc: "この階の　敵の　いる所が　わかる",
	flavor:
		"敵の　居場所が　わかる。敵の　ほうは　とっくに　こっちを　ヲチ　している",
});
add({
	id: "s_treasure",
	cat: "scroll",
	name: "発掘スレ",
	desc: "この階の　道具の　ある所が　わかる",
	flavor:
		"道具の　場所が　わかる。ついでに　ワイの　中学の　ころの　ポエムも　掘りだされた",
});
add({
	id: "s_hold",
	cat: "scroll",
	name: "凍結スレ",
	desc: "まわりの　敵が　動けなくなる",
	flavor:
		"まわりの　敵が　止まる。理由を　聞いても、運営は　「仕様です」と　しか　言わない",
});
add({
	id: "s_blast",
	cat: "scroll",
	name: "炎上スレ",
	desc: "部屋じゅうの　敵に　ダメージ",
	flavor:
		"部屋じゅうが　燃える。勢いは　過去　最高。スレの　中身は　だれも　読んでいない",
});
add({
	id: "s_ward",
	cat: "scroll",
	name: "避難所スレ",
	desc: "床に　置くと　そこが　避難所になる（読んでも　効かない）。その上では　となりから　なぐられない。置くと　拾えない",
	flavor: "となりから　なぐられない。とても　平和。住人が　ワイ　1人　だから",
});
add({
	id: "s_recharge",
	cat: "scroll",
	name: "次スレ",
	desc: "道具を　1つ　えらぶ。杖なら　回数が　ふえ、スレなら　同じ　スレが　もう1つ　立つ",
	flavor:
		"次スレを　立てた　人は　「乙」が　もらえる。もらえるのは　「乙」　だけ",
});
add({
	id: "s_bread",
	cat: "scroll",
	name: "飯テロスレ",
	desc: "道具を　1つ　えらんで　ぷゆゆパンに　変える",
	// キリコが 生まれた「おんJ民でボカロ作ろうぜ7」（2026/08/21）に「自信作」として 貼られた 鮭の 歌詞から
	flavor: "「生ジャケじゃけじゃけ」を　貼っても、出てくるのは　パン",
});
add({
	id: "s_snare",
	cat: "scroll",
	name: "釣りスレ",
	desc: "この階に　罠が　ふえる（安価の罠も）",
	flavor:
		"罠が　ふえる。このスレで　いちばん　釣られて　いるのは、読んだ　本人",
});
add({
	id: "s_escape",
	cat: "scroll",
	name: "帰還スレ",
	desc: "読むと　その場で　地上へ　もどる。持ち帰る品を　持っていると　ふつうは　きかない",
	flavor: "帰還報告に「で？」と　返すまでが　様式美",
});
add({
	// おーぷんの サイコロ機能 !sk（!saikoro。スレ主が 書いた 目の 中から 1つが 出る。「ガチャスレ」でも 使う）。
	// トルネコ1の パルプンテの巻物（もっと不思議だけ）。8つの 目の うち 1つが 出る
	// トルネコ1と 同じく ふだんは 見えない（晒し草を 飲んだ 階でだけ 見えて 読める）
	id: "s_gacha",
	cat: "scroll",
	name: "!skスレ",
	invisible: true,
	desc: "スレ主の　決めた　8つの　目から　1つが　出る（全快・レベル＋3・敵が　全滅……5階　先へ　飛ばされる　ことも）。ふだんは　見えず、晒し草を　飲んだ　階でだけ　読める",
	flavor: "8つの　目を　決めた　スレ主は、スレを　立てて　すぐ　寝た",
});

// ───────── 杖（未識別。前に魔法の弾を撃つ。投げて 当てても 効く（回数0でも。当たった 杖は なくなる）） ─────────
add({
	id: "w_bolt",
	cat: "staff",
	name: "フルボッコの杖",
	charges: [6, 9],
	desc: "敵に　20　前後の　ダメージ（かならず　当たる）",
	flavor: "ID　1つに　レス　300。全員が　自分だけは　正義だと　思っている",
});
add({
	id: "w_reel",
	cat: "staff",
	name: "安価の杖",
	charges: [4, 6],
	desc: "敵を　混乱させる",
	flavor:
		"安価は　絶対。敵も　例外では　ない。だれが　決めたかは　敵も　知らない",
});
add({
	id: "w_sleep",
	cat: "staff",
	name: "寝落ちの杖",
	charges: [3, 6],
	desc: "敵を　眠らせる",
	flavor:
		"「ちょっと　風呂」と　書いて、そのまま　朝。敵にも　同じ　ことが　起きる",
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
	flavor:
		"改変コピペと　同じ。たまに　元ネタより　強い　やつが　できて　しまう",
});
add({
	id: "w_send",
	cat: "staff",
	name: "隔離の杖",
	charges: [3, 5],
	desc: "敵を　この階の　どこかへ　飛ばす",
	flavor: "隔離した　敵は、隔離先で　なぜか　本スレより　楽しそうに　している",
});
add({
	id: "w_slow",
	cat: "staff",
	name: "ラグの杖",
	charges: [3, 5],
	desc: "敵を　鈍足にする",
	flavor:
		"敵が　コマ送りで　近づいて　くる。おそいのに、なぜか　こわさは　増した",
});
add({
	id: "w_edge",
	cat: "staff",
	name: "諸刃の杖",
	charges: [3, 5],
	desc: "自分の　HPが　半分になり、敵の　HPが　1になる",
	flavor:
		"相手は　HP　1、自分は　半分。レスバの　勝者は、だいたい　こういう　顔を　している",
});
add({
	id: "w_split",
	cat: "staff",
	// 敵の コピペと 同じく ふやす
	name: "コピペの杖",
	charges: [3, 5],
	desc: "敵が　2匹に　ふえる",
	flavor: "1匹が　2匹。2匹が　4匹。コピペの　こわさを、身を　もって　知る　杖",
});
add({
	id: "w_haste",
	cat: "staff",
	name: "kskの杖",
	charges: [3, 6],
	desc: "敵が　倍速になる",
	flavor: "kskしたいのは　スレで　あって、敵では　ない",
});
add({
	// おーぷんの バツポチ：レスの ✕ を ポチると、その ID の 書きこみが 自分にだけ 見えなく なる
	// （荒らしよけ。ID が かわる 1日 かぎり）。相手は 消えずに 書きつづける
	id: "w_batsu",
	cat: "staff",
	name: "バツポチの杖",
	charges: [3, 5],
	desc: "敵が　見えなく　なる（晒し草を　飲めば　見える）",
	flavor:
		"バツポチしても　相手は　そこに　いる。見えなく　なるのは　自分　だけ",
});
add({
	// アフィ：スレを 勝手に まとめて 広告で もうける まとめブログ（転載で おんJ民の レスを もっていく）
	id: "w_afi",
	cat: "staff",
	name: "アフィの杖",
	charges: [3, 5],
	desc: "敵に　もちものを　1つ　転載される（たおせば　取りかえせる）",
	flavor:
		"書いたのは　おんJ民。もうけるのは　アフィ。この杖を　売ったのも　たぶん　アフィ",
});
add({
	// 凸 ＝ 乗りこむ こと。ここでは 敵の ほうが 凸して くる
	id: "w_totsu",
	cat: "staff",
	name: "凸の杖",
	charges: [3, 6],
	desc: "敵が　キリコの　となりへ　飛んで　くる",
	flavor: "「いまから　凸する」と　書いた　敵が、ほんとうに　となりに　来た",
});
add({
	// 言い負かして 終わらせる「論破」（おんJでも「動物愛護スレのイッチを論破してしまったなぁ」）。
	// トルネコ1の ザキの杖（もっと不思議だけ。いつも 回数0で 出て、祈りの巻物で ふやして 使う）
	id: "w_rebut",
	cat: "staff",
	name: "論破の杖",
	charges: [0, 0],
	desc: "敵を　一撃で　たおす（かならず　当たる）。いつも　回数0で　見つかるので、次スレで　ふやして　使う",
	flavor: "はい、論破。なお　次スレが　ないと　何も　言えない",
});

// ───────── 野球の ボール（束。投げると 1球ずつ 飛ぶ。トルネコ1の 矢。cat は arrow） ─────────
// ダンジョンの ボールを 投げる 敵（core/data/monsters.ts）と そろえて、矢では なく 球。名前は おんJの 野球の ことば。
add({
	// 打者を ねらう 球（ビーンボール）。人に 当てる 球なので 敵に 投げる（作者
	// 「フォークは 人に 当てる ものじゃない」）
	id: "a_wood",
	cat: "arrow",
	name: "ビーンボール",
	atk: 4,
	desc: "打者を　ねらう　球。投げると　1球ずつ　飛ぶ。外れた　球は　ひろえる",
	flavor: "「すっぽ抜けや」と　言いながら、10球　つづけて　頭を　ねらう",
});
add({
	// 藤川球児の「火の玉ストレート」（来ると わかっていても 打てない 直球）
	id: "a_iron",
	cat: "arrow",
	name: "火の玉ストレート",
	atk: 12,
	desc: "来ると　わかっていても　打てない　直球。投げると　1球ずつ　飛ぶ。外れた　球は　ひろえる",
	flavor: "ど真ん中しか　来ない。敵も　わかっている。わかっていて　当たる",
});

// ───────── 食べもの ─────────
add({
	id: "f_bread",
	cat: "food",
	name: "片親パン",
	desc: "満腹度が　50　回復",
	flavor: "安くて　でかくて　甘い。この　3つだけで、おんJは　1000まで　語れる",
});
add({
	id: "f_large",
	cat: "food",
	name: "ぷゆゆパン",
	desc: "満腹度が　100　回復",
	flavor: "🥺　の　顔に　焼けている。かじると　目が　合う",
});
add({
	id: "f_moldy",
	cat: "food",
	name: "チギュリパン",
	desc: "満腹度が　100　回復。ちからが　1　下がり、HPも　へる",
	flavor:
		"おなかは　満ちる。ちからと　HPは　へる。食レポ　スレは　いつも　荒れる",
});

// ───────── 目的の品（床には出ない） ─────────
// 本筋の 板の 底で 拾う 撮れ高（STORY.md §5 場面の 一覧）。
/** 目的の品の 専用の 絵（ui/art/itemArt.ts → scripts/make-items.mjs で 書き出す）。 */
const art = (name: string): string => `pub:sprites/items/${name}.png`;

add({
	id: "genban",
	cat: "goal",
	icon: art("genban"),
	name: "長湯スレ",
	desc: "風呂板の　湯守が　かかえていた、よく　伸びた　スレ。コラボの　撮れ高。持ち帰ろう",
	flavor:
		"のぼせるまで　しゃべった　コラボ配信。最後の　200コメントは　「のぼせた」",
});
add({
	id: "needle",
	cat: "goal",
	icon: art("needle"),
	name: "パン板の　サイン色紙",
	desc: "パン兵長が　しぶしぶ　書いた　サイン色紙。初配信の　記念。パンの　においが　する。持ち帰ろう",
	flavor: "「キリコさんへ　パン板より（パンで）」",
});
add({
	id: "tsuzuki",
	cat: "goal",
	icon: art("tsuzuki"),
	name: "町の　主電源",
	desc: "電池板の　いちばん下に　しずんでいた、町の　配信の　主電源。持ち帰ろう",
	flavor: "落とすと、町じゅうの　配信が　切れる",
});

// 過去ログの底（99階）の 品：いちばん 古い コメント（STORY.md §5 後日談）
add({
	id: "g1001",
	cat: "goal",
	icon: art("g1001"),
	name: "いちばん古い　コメント",
	desc: "過去ログの　いちばん底に　しずんでいた、2005年の　コメント",
	flavor: "ふぇ…ふぇ……フェニックス！",
});

// ロゼの 依頼（ボカロ作り避難所）の 品
add({
	id: "oto_ini",
	cat: "goal",
	icon: art("memo"),
	name: "ロゼの　原音設定",
	desc: "ボカロ作り避難所の　いちばん　奥に　残されていた、ロゼの　声の　設定。持ち帰って　わたそう",
	flavor: "「常識は（アル！）　モラルは（ナイ！）」",
});

// 植民地の おみやげ（持ち帰る品。その板の マスコットに ゆかりの 物）
add({
	id: "kinonyan",
	cat: "goal",
	icon: art("kinonyan"), // 額に 入った AA（敵の 絵とは 別）
	name: "きのにゃんの　AA",
	desc: "[ｷ・Д・ﾉ]　きのこ板の　底で　ふんぞりかえっていた。持ち帰ろう",
	flavor: "態度が　でかい。持ち帰っても　たぶん　でかい",
});
add({
	id: "yashi",
	cat: "goal",
	icon: "sp:NwQNzoN", // RPGEN「ココナッツ　やしのみ」
	name: "ナツコの　ヤシの実",
	desc: "離島・沖縄板の　山の　上に　引っかかっていた　ヤシの実。持ち帰ろう",
	flavor: "ヤッシッシ～。島民は　6人。拾ったのは　7人目",
});
// おーぷぬの おんJ関連板の 品（2026-10-13）
add({
	id: "hoshi",
	cat: "goal",
	icon: art("hoshi"),
	name: "水星の　かけら",
	desc: "マーキュリーの　いちばん　底で　光っていた。持ち帰ろう",
	flavor: "おんJに　飽きた　人の、ほのぼのした　温度",
});
add({
	id: "tojoken",
	cat: "goal",
	icon: art("tojoken"),
	name: "おんMu国際空港の　搭乗券",
	desc: "沈んだ　大陸の　空港の、行き先の　ない　搭乗券。持ち帰ろう",
	flavor: "「新境地への　旅行　はじめり」",
});
add({
	id: "kimchi",
	cat: "goal",
	icon: art("kimchi"),
	name: "おんキムの　キムチ壺",
	desc: "管理部の　奥で　漬かっていた。持ち帰ろう",
	flavor: "植民地は　ふえても、キムチは　1つ",
});
add({
	id: "grimoire",
	cat: "goal",
	icon: art("grimoire"),
	name: "†漆黒の　魔導書†",
	desc: "闇の　塔の　てっぺんに　封印されていた。持ち帰ろう",
	flavor: "読むと、14歳の　ころの　自分が　ふりむく",
});
add({
	id: "takoyaki",
	cat: "goal",
	icon: art("takoyaki"),
	name: "たこのみんの　たこ焼き",
	desc: "おんたこの　屋上で　焼けていた。😡の　形を　している。持ち帰ろう",
	flavor: "怒って　いるのでは　ない。焼けて　いるだけ",
});
add({
	id: "uchiwa",
	cat: "goal",
	icon: "sp:SPpbIcP", // RPGEN「うちわ」
	name: "マシーの　うちわ",
	desc: "やぐらの　てっぺんに　落ちていた　うちわ。持ち帰ろう",
	flavor: "祭りが　終わっても、だれも　いない　やぐらを　あおぎつづけていた",
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
 * 風呂板（14階）も この 表（重みは 割合。1回で 出る数は 3/4 ほど）。
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
	// 指輪 11
	{ kind: "r_might", weight: 2 },
	{ kind: "r_sustain", weight: 1 },
	{ kind: "r_hunger", weight: 1 },
	{ kind: "r_trap", weight: 1 },
	{ kind: "r_awake", weight: 1 },
	{ kind: "r_purity", weight: 1 },
	{ kind: "r_stealth", weight: 1 },
	{ kind: "r_clamor", weight: 1 },
	{ kind: "r_ward", weight: 1 },
	{ kind: "r_patrol", weight: 1 },
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
	// 杖 13
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
	{ kind: "w_batsu", weight: 1 },
	{ kind: "w_afi", weight: 1 },
	{ kind: "w_totsu", weight: 1 },
	// 矢 9
	{ kind: "a_wood", weight: 6 },
	{ kind: "a_iron", weight: 3 },
	// 食べもの 8（2026-10-10 に 15 → 10 → 8。7 では ボットの 飢え死にが 3割）（2026-10-10 の 2回め：床の パンだけで 1階 40% ほど 出て、始めの 200% と お弁当・パン兵の ぶんが まるまる 余っていた。長い 板は 1階 25% ほど、短い 板は 10% ほどに）
	{ kind: "f_bread", weight: 5 },
	{ kind: "f_large", weight: 3 },
	{ kind: "f_moldy", weight: 2 },
];

/** カテゴリの表示名（図鑑の見出し）。 */
export const CAT_NAME: Record<ItemCat, string> = {
	weapon: "武器",
	shield: "板",
	ring: "トリップ",
	herb: "草",
	scroll: "スレ",
	staff: "杖",
	arrow: "ボール",
	food: "メシ",
	goal: "目的の品",
};

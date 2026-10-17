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
	desc: "木をけずったぬるい棒",
	flavor:
		"ぬるい棒。ぬるぽの「ぬる」はこの棒から来たという説を、いまワイが考えた",
});
add({
	id: "copper",
	cat: "weapon",
	sound: { swing: "swing_blade", hit: "hit_copper" },
	name: "名無しの剣",
	atk: 3,
	desc: "ありふれた剣。名無しさんの標準装備",
	flavor: "累計2億本出荷。持ち主の名前はぜんぶ「風吹けば名無し」",
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
	desc: "とても強いが、なぐるたびに修正値が1　へる（強さが0になると折れる）。ボスには効かない。売っても0",
	flavor: "ぷゆゆが「つぎはいけるぷゆ🥺」とくれた。根拠は🥺だけ",
});
add({
	id: "bat",
	cat: "weapon",
	sound: { swing: "swing_blunt", hit: "hit_bat" },
	name: "ガッのバット",
	atk: 4,
	desc: "よくしなるバット。ぬるぽにガッ",
	flavor:
		"ぬるぽを待って20年。ガッする相手が来ないので、ふつうに敵をなぐっている",
});
add({
	id: "wyrmbane",
	cat: "weapon",
	sound: { swing: "swing_blade", hit: "hit_wyrm" },
	name: "ワイ断ちの剣",
	atk: 5,
	desc: "竜（ワイバーン）にはダメージが2倍",
	flavor:
		"竜とワイを切る。「ワイ、実は」で始まるレスを見ると、勝手にさやから出る",
});
add({
	id: "steel",
	cat: "weapon",
	sound: { swing: "swing_blade", hit: "hit_steel" },
	name: "コテハンの剣",
	atk: 6,
	desc: "よく切れる剣。名無しより一段上",
	flavor: "名無しより1段強い。かわりに10年前の書きこみをぜんぶ掘られる",
});
add({
	id: "starsword",
	cat: "weapon",
	sound: { swing: "swing_blade", hit: "hit_star" },
	name: "降臨の剣",
	atk: 7,
	desc: "空から降臨した鉄の剣",
	flavor: "空から降ってきた。降臨した本人は3レス書いて「落ちます」と消えた",
});
add({
	id: "mic",
	cat: "weapon",
	sound: { swing: "swing_blunt", hit: "hit_mic" },
	name: "ネ申マイク",
	atk: 10,
	desc: "スタンドごと振る。いちばん重くていちばん強い",
	flavor: "歌えば神曲、振れば鈍器。おんJで評価されたのは鈍器のほう",
});

// ───────── 盾 ─────────
add({
	id: "leather",
	cat: "shield",
	name: "ダイエット板",
	def: 2,
	desc: "うすい板。錆びない。おなかがへりにくい",
	flavor: "住人の「明日から本気」は、もう5000日連続で更新されている",
});
add({
	id: "bronze",
	cat: "shield",
	name: "雑談板",
	def: 3,
	desc: "ありふれた板",
	flavor: "最初の話題は天気。10レス後にはカレーの具でケンカしている",
});
add({
	id: "scale",
	cat: "shield",
	name: "スルー板",
	def: 4,
	desc: "毒でちからを下げられない（荒らしはスルー）",
	flavor:
		"「荒らしはスルー」と書いた人が、そのあと500レス荒らしとレスバしている",
});
add({
	id: "mirror",
	cat: "shield",
	name: "永久保存板",
	def: 5,
	desc: "錆びない（永久保存版）",
	flavor: "錆びない。【永久保存版】と書かれたスレは、翌朝ぜんぶ落ちていた",
});
add({
	id: "steelsh",
	cat: "shield",
	name: "鉄板",
	def: 6,
	desc: "かたい板。守りは鉄板",
	flavor: "かたい。鉄板ネタもかたい。3回目からだれも笑わないが、かたい",
});
add({
	id: "fireward",
	cat: "shield",
	name: "火消し板",
	def: 7,
	desc: "炎のダメージが半分（炎上の火消し）",
	flavor:
		"火消しが来たスレは2倍燃える。この板は半分にする。差し引きいつもどおり",
});
add({
	id: "starshield",
	cat: "shield",
	name: "ネ申板",
	def: 10,
	desc: "空から降臨した鉄の板",
	flavor: "ネ申が置いていった板。次の降臨は「来週」と書いたまま14年",
});

// ───────── 指輪（未識別） ─────────
add({
	id: "r_might",
	cat: "ring",
	name: "◆筋肉",
	desc: "ちからが3　上がる（のろいなら下がる）",
	flavor: "筋肉は裏切らない。のろわれていると、筋肉のほうから辞表が届く",
});
add({
	id: "r_sustain",
	cat: "ring",
	name: "◆腹いっぱい",
	desc: "おなかがへらない",
	flavor: "食べなくても平気。片親パンの売り上げが、また1つ落ちる",
});
add({
	id: "r_hunger",
	cat: "ring",
	name: "◆大食い",
	desc: "おなかが2倍へるが、HPも2倍はやく回復する",
	flavor: "傷は2倍でふさがる。財布の傷はふさがらない",
});
add({
	id: "r_trap",
	cat: "ring",
	name: "◆釣られない",
	desc: "罠にかからない",
	flavor: "罠はふまない。スレの釣りには毎日かかる。それはまたべつの話",
});
add({
	id: "r_awake",
	cat: "ring",
	name: "◆徹夜",
	desc: "眠らなくなる",
	flavor: "眠らない。朝5時のスレで「まだ起きてるやつおる？」と聞きつづける",
});
add({
	id: "r_purity",
	cat: "ring",
	name: "◆スルースキル",
	desc: "ちからを下げられない",
	flavor: "スルースキル検定1級。合格通知もスルーしたので、証明はできない",
});
add({
	id: "r_stealth",
	cat: "ring",
	name: "◆sage進行",
	desc: "眠っている敵が起きない",
	flavor: "sageて書けば敵も起きない。1年後、スレの住人はワイ1人になった",
});
add({
	id: "r_clamor",
	cat: "ring",
	name: "◆全力age",
	desc: "眠っている敵がすぐ起きる",
	flavor: "ageた瞬間、部屋じゅうの敵と、となりの部屋のおかんが起きる",
});
add({
	id: "r_ward",
	cat: "ring",
	name: "◆保守",
	desc: "レベルや最大HPを下げられない",
	flavor: "レベルを守る。「保守」だけで1000まで行ったスレもある。中身はない",
});
add({
	// トルネコの ルーラの指輪（元は ローグの テレポートの指輪）。スレを 巡回するように、ときどき 階の どこかへ 飛ぶ
	id: "r_patrol",
	cat: "ring",
	name: "◆巡回",
	desc: "ときどきこの階のどこかへ飛ばされる",
	flavor: "巡回しているつもりが、気づけば朝の4時と知らない部屋",
});

// ───────── 草・実（未識別） ─────────
add({
	id: "h_heal",
	cat: "herb",
	name: "草",
	desc: "HPが25　回復（満タンなら最大HP＋1）",
	flavor: "飲むと治る。食レポをたのむと、「草」とだけ返ってくる",
});
add({
	id: "h_greater",
	cat: "herb",
	name: "大草原",
	desc: "HPが100　回復（満タンなら最大HP＋2）",
	flavor: "大草原不可避。笑いすぎて骨折まで治ったという報告が3件",
});
add({
	id: "h_poison",
	cat: "herb",
	name: "荒らし草",
	desc: "HPが5　へり（たおれはしない）、ちからが3　下がる",
	flavor:
		"ひと口でちからがぬける。荒らしの気持ちがわかる草。わかりたくはなかった",
});
add({
	id: "h_might",
	cat: "herb",
	name: "プロテイン草",
	desc: "ちからが1　上がる",
	flavor: "原材料は草100％。どこにたんぱく質があったのかは、メーカーも知らない",
});
add({
	id: "h_growth",
	cat: "herb",
	name: "忍法帖の実",
	desc: "めったにない実。レベルが1　上がる",
	flavor: "毎日書きこんで3年かかるレベル上げを、ひと口ですませる背徳の味",
	// メタルぷゆゆの 落とし物。はじめから 正体が わかり、見た目も 専用
	rare: true,
});
add({
	id: "h_swift",
	cat: "herb",
	name: "ksk草",
	desc: "しばらく倍速で動ける",
	flavor: "倍速で動ける。kskしすぎて、スレタイを読む前に1000が来る",
});
add({
	id: "h_blind",
	cat: "herb",
	// おーぷんの スレ主コマンド !aku。アク禁されると スレが 見えない。投げれば 敵を アク禁（とくぎも 封じる）
	name: "アク禁草",
	desc: "アク禁されて何も見えなくなる（スレにも書きこめない）。投げると敵をアク禁する",
	flavor: "見えない。書けない。反省もしない。解除されたその日にまたくらう",
});
add({
	id: "h_blink",
	cat: "herb",
	// どこかへ 飛ばされる「左遷」（おんJでも「北関東左遷ワイ、山田うどんに出会う」など）。
	// バルスは スレを 消して 逃げる ことで、跳ぶ ことでは ないので 使わない
	name: "左遷草",
	desc: "この階のどこかへ飛ばされる",
	flavor: "辞令：この階のどこか。単身赴任。手当は出ない",
});
add({
	id: "h_reel",
	cat: "herb",
	// 安価で 動きを 決められて 思いどおりに 動けない
	name: "安価草",
	desc: "安価にふりまわされる（混乱）。投げると敵を混乱させる",
	flavor: ">>5が「右」、>>6が「左」と言うので、ワイはまっすぐ壁にぶつかる",
});
add({
	// トルネコ1の まどわし草（頭お花畑）
	id: "h_daze",
	cat: "herb",
	name: "お花畑草",
	desc: "まどわされる（敵が自分の姿に、道具がお花に見える）。投げると敵が逃げだす",
	flavor: "敵がぜんぶ自分に見える。なぐるか迷っているうちになぐられる",
});
add({
	id: "h_sleep",
	cat: "herb",
	name: "寝落ち草",
	desc: "眠ってしまう。投げると敵を眠らせる",
	flavor: "「ちょっと横になるわ」――最後の書きこみ（3日前）",
});
add({
	id: "h_antidote",
	cat: "herb",
	// おんJの「このスレが上がってるの見たら水分補給しろ」。弱ったのが もとに もどる
	name: "水分補給草",
	desc: "下がったちからが元にもどる",
	flavor: "このスレが上がっているのを見たら飲め。見ていなくても飲め",
});
add({
	id: "h_fire",
	cat: "herb",
	name: "燃料投下草",
	desc: "前に炎を吐く（足元の道具も燃える）",
	flavor: "前が燃える。本人は「燃料を置いただけ」と供述している",
});
add({
	id: "h_sight",
	cat: "herb",
	name: "晒し草",
	desc: "この階の見えない敵と見えない道具が見える。アク禁もとける",
	flavor: "見えないものがぜんぶ見える。見なくてよかったものもぜんぶ見える",
});

// ───────── スレ（巻物にあたる。未識別） ─────────
add({
	id: "s_appraise",
	cat: "scroll",
	name: "有識者スレ",
	desc: "有識者ニキが道具を1つ識別する",
	flavor: "有識者ニキ到着まで0.2秒。ふだん何をしているのかは、だれも聞けない",
});
add({
	id: "s_whet",
	cat: "scroll",
	name: "腹筋スレ",
	desc: "装備中の武器が＋1。のろいもとける",
	flavor:
		"IDの数字のぶん腹筋。出たのは「9876」。ワイのかわりに武器が鍛えられた",
});
add({
	id: "s_temper",
	cat: "scroll",
	name: "耐久スレ",
	desc: "装備中の板が＋1。のろいもとける",
	flavor: "「1000まで寝ない」耐久スレ。住人はぜんいん寝た。板だけが耐えきった",
});
add({
	id: "s_uncurse",
	cat: "scroll",
	name: "お祓いスレ",
	desc: "装備ののろいをとく",
	flavor: "神主が「祓った」と1レス書いて、ID　も出さずに帰った。のろいはとけた",
});
add({
	id: "s_rustproof",
	cat: "scroll",
	name: "延命スレ",
	desc: "装備中の板が錆びなくなる",
	flavor: "終わるべきものを終わらせない技術。おんJの半分はこれでできている",
});
add({
	id: "s_map",
	cat: "scroll",
	name: "聖地巡礼スレ",
	desc: "この階の地形と罠がわかる",
	flavor: "地形も罠も完璧にわかる。肝心のアニメの人はどこにもいない",
});
add({
	id: "s_sense",
	cat: "scroll",
	name: "ヲチスレ",
	desc: "この階の敵のいる所がわかる",
	flavor: "敵の居場所がわかる。敵のほうはとっくにこっちをヲチしている",
});
add({
	id: "s_treasure",
	cat: "scroll",
	name: "発掘スレ",
	desc: "この階の道具のある所がわかる",
	flavor: "道具の場所がわかる。ついでにワイの中学のころのポエムも掘りだされた",
});
add({
	id: "s_hold",
	cat: "scroll",
	name: "凍結スレ",
	desc: "まわりの敵が動けなくなる",
	flavor:
		"まわりの敵が止まる。理由を聞いても、運営は「仕様です」としか言わない",
});
add({
	id: "s_blast",
	cat: "scroll",
	name: "炎上スレ",
	desc: "部屋じゅうの敵にダメージ",
	flavor: "部屋じゅうが燃える。勢いは過去最高。スレの中身はだれも読んでいない",
});
add({
	id: "s_ward",
	cat: "scroll",
	name: "避難所スレ",
	desc: "床に置くとそこが避難所になる（読んでも効かない）。その上ではとなりからなぐられない。置くと拾えない",
	flavor: "となりからなぐられない。とても平和。住人がワイ1人だから",
});
add({
	id: "s_recharge",
	cat: "scroll",
	name: "次スレ",
	desc: "道具を1つえらぶ。杖なら回数がふえ、スレなら同じスレがもう1つ立つ",
	flavor: "次スレを立てた人は「乙」がもらえる。もらえるのは「乙」だけ",
});
add({
	id: "s_bread",
	cat: "scroll",
	name: "飯テロスレ",
	desc: "道具を1つえらんでぷゆゆパンに変える",
	// キリコが 生まれた「おんJ民でボカロ作ろうぜ7」（2026/08/21）に「自信作」として 貼られた 鮭の 歌詞から
	flavor: "「生ジャケじゃけじゃけ」を貼っても、出てくるのはパン",
});
add({
	id: "s_snare",
	cat: "scroll",
	name: "釣りスレ",
	desc: "この階に罠がふえる（安価の罠も）",
	flavor: "罠がふえる。このスレでいちばん釣られているのは、読んだ本人",
});
add({
	id: "s_escape",
	cat: "scroll",
	name: "帰還スレ",
	desc: "読むとその場で地上へもどる。持ち帰る品を持っているとふつうはきかない",
	flavor: "帰還報告に「で？」と返すまでが様式美",
});
add({
	// おーぷんの サイコロ機能 !sk（!saikoro。スレ主が 書いた 目の 中から 1つが 出る。「ガチャスレ」でも 使う）。
	// トルネコ1の パルプンテの巻物（もっと不思議だけ）。8つの 目の うち 1つが 出る
	// トルネコ1と 同じく ふだんは 見えない（晒し草を 飲んだ 階でだけ 見えて 読める）
	id: "s_gacha",
	cat: "scroll",
	name: "!skスレ",
	invisible: true,
	desc: "スレ主の決めた8つの目から1つが出る（全快・レベル＋3・敵が全滅……5階先へ飛ばされることも）。ふだんは見えず、晒し草を飲んだ階でだけ読める",
	flavor: "8つの目を決めたスレ主は、スレを立ててすぐ寝た",
});

// ───────── 杖（未識別。前に魔法の弾を撃つ。投げて 当てても 効く（回数0でも。当たった 杖は なくなる）） ─────────
add({
	id: "w_bolt",
	cat: "staff",
	name: "フルボッコの杖",
	charges: [6, 9],
	desc: "敵に20　前後のダメージ（かならず当たる）",
	flavor: "ID　1つにレス300。全員が自分だけは正義だと思っている",
});
add({
	id: "w_reel",
	cat: "staff",
	name: "安価の杖",
	charges: [4, 6],
	desc: "敵を混乱させる",
	flavor: "安価は絶対。敵も例外ではない。だれが決めたかは敵も知らない",
});
add({
	id: "w_sleep",
	cat: "staff",
	name: "寝落ちの杖",
	charges: [3, 6],
	desc: "敵を眠らせる",
	flavor: "「ちょっと風呂」と書いて、そのまま朝。敵にも同じことが起きる",
});
add({
	id: "w_seal",
	cat: "staff",
	name: "規制の杖",
	charges: [5, 8],
	desc: "敵のとくぎを封じる",
	flavor: "規制に文句を言いたくても、規制されていて言えない",
});
add({
	id: "w_change",
	cat: "staff",
	name: "改変の杖",
	charges: [3, 6],
	desc: "敵をほかの敵に変える",
	flavor: "改変コピペと同じ。たまに元ネタより強いやつができてしまう",
});
add({
	id: "w_send",
	cat: "staff",
	name: "隔離の杖",
	charges: [3, 5],
	desc: "敵をこの階のどこかへ飛ばす",
	flavor: "隔離した敵は、隔離先でなぜか本スレより楽しそうにしている",
});
add({
	id: "w_slow",
	cat: "staff",
	name: "ラグの杖",
	charges: [3, 5],
	desc: "敵を鈍足にする",
	flavor: "敵がコマ送りで近づいてくる。おそいのに、なぜかこわさは増した",
});
add({
	id: "w_edge",
	cat: "staff",
	name: "諸刃の杖",
	charges: [3, 5],
	desc: "自分のHPが半分になり、敵のHPが1になる",
	flavor:
		"相手はHP　1、自分は半分。レスバの勝者は、だいたいこういう顔をしている",
});
add({
	id: "w_split",
	cat: "staff",
	// 敵の コピペと 同じく ふやす
	name: "コピペの杖",
	charges: [3, 5],
	desc: "敵が2匹にふえる",
	flavor: "1匹が2匹。2匹が4匹。コピペのこわさを、身をもって知る杖",
});
add({
	id: "w_haste",
	cat: "staff",
	name: "kskの杖",
	charges: [3, 6],
	desc: "敵が倍速になる",
	flavor: "kskしたいのはスレであって、敵ではない",
});
add({
	// おーぷんの バツポチ：レスの ✕ を ポチると、その ID の 書きこみが 自分にだけ 見えなく なる
	// （荒らしよけ。ID が かわる 1日 かぎり）。相手は 消えずに 書きつづける
	id: "w_batsu",
	cat: "staff",
	name: "バツポチの杖",
	charges: [3, 5],
	desc: "敵が見えなくなる（晒し草を飲めば見える）",
	flavor: "バツポチしても相手はそこにいる。見えなくなるのは自分だけ",
});
add({
	// アフィ：スレを 勝手に まとめて 広告で もうける まとめブログ（転載で おんJ民の レスを もっていく）
	id: "w_afi",
	cat: "staff",
	name: "アフィの杖",
	charges: [3, 5],
	desc: "敵にもちものを1つ転載される（たおせば取りかえせる）",
	flavor:
		"書いたのはおんJ民。もうけるのはアフィ。この杖を売ったのもたぶんアフィ",
});
add({
	// 凸 ＝ 乗りこむ こと。ここでは 敵の ほうが 凸して くる
	id: "w_totsu",
	cat: "staff",
	name: "凸の杖",
	charges: [3, 6],
	desc: "敵がキリコのとなりへ飛んでくる",
	flavor: "「いまから凸する」と書いた敵が、ほんとうにとなりに来た",
});
add({
	// 言い負かして 終わらせる「論破」（おんJでも「動物愛護スレのイッチを論破してしまったなぁ」）。
	// トルネコ1の ザキの杖（もっと不思議だけ。いつも 回数0で 出て、祈りの巻物で ふやして 使う）
	id: "w_rebut",
	cat: "staff",
	name: "論破の杖",
	charges: [0, 0],
	desc: "敵を一撃でたおす（かならず当たる）。いつも回数0で見つかるので、次スレでふやして使う",
	flavor: "はい、論破。なお次スレがないと何も言えない",
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
	desc: "打者をねらう球。投げると1球ずつ飛ぶ。外れた球はひろえる",
	flavor: "「すっぽ抜けや」と言いながら、10球つづけて頭をねらう",
});
add({
	// 藤川球児の「火の玉ストレート」（来ると わかっていても 打てない 直球）
	id: "a_iron",
	cat: "arrow",
	name: "火の玉ストレート",
	atk: 12,
	desc: "来るとわかっていても打てない直球。投げると1球ずつ飛ぶ。外れた球はひろえる",
	flavor: "ど真ん中しか来ない。敵もわかっている。わかっていて当たる",
});

// ───────── 食べもの ─────────
add({
	id: "f_bread",
	cat: "food",
	name: "片親パン",
	desc: "満腹度が50　回復",
	flavor: "安くてでかくて甘い。この3つだけで、おんJは1000まで語れる",
});
add({
	id: "f_large",
	cat: "food",
	name: "ぷゆゆパン",
	desc: "満腹度が100　回復",
	flavor: "🥺の顔に焼けている。かじると目が合う",
});
add({
	id: "f_moldy",
	cat: "food",
	name: "チギュリパン",
	desc: "満腹度が100　回復。ちからが1　下がり、HPもへる",
	flavor: "おなかは満ちる。ちからとHPはへる。食レポスレはいつも荒れる",
});

// ───────── 目的の品（床には出ない） ─────────
// 本筋の 板の 底で 拾う 品（STORY.md §4.9 場面の 一覧）。
/** 目的の品の 専用の 絵（ui/art/itemArt.ts → scripts/make-items.mjs で 書き出す）。 */
const art = (name: string): string => `pub:sprites/items/${name}.png`;

add({
	id: "genban",
	cat: "goal",
	icon: art("genban"),
	name: "長湯スレ",
	desc: "42℃の番頭がかかえていた、よく伸びたスレ。41.5℃で決着した記念。持ち帰ろう",
	flavor: "のぼせるまでもめたスレ。最後の200レスは「ぬるい」",
});
add({
	id: "needle",
	cat: "goal",
	icon: art("needle"),
	name: "食パンの国旗",
	desc: "パン板が独立の旗に立てた食パン。広場の旗は、これの写しだった。持ち帰ろう",
	flavor: "独立国の国旗。賞味期限がある",
});
add({
	id: "tsuzuki",
	cat: "goal",
	icon: art("tsuzuki"),
	name: "町の主電源",
	desc: "電池板のてっぺんで、電池ニキがひとりで守っていた町の主電源。持ち帰ろう",
	flavor: "落とすと、町じゅうの明かりが消える",
});

// 過去ログの底（99階）の 品：いちばん 古い コメント（STORY.md §5 後日談）
add({
	id: "g1001",
	cat: "goal",
	icon: art("g1001"),
	name: "いちばん古いレス",
	desc: "過去ログのいちばん底にしずんでいた、2005年のレス",
	flavor: "ふぇ…ふぇ……フェニックス！",
});

// ロゼの 依頼（ボカロ作り避難所）の 品
add({
	id: "oto_ini",
	cat: "goal",
	icon: art("memo"),
	name: "ロゼの原音設定",
	desc: "ボカロ作り避難所のいちばん奥に残されていた、ロゼの声の設定。持ち帰ってわたそう",
	flavor: "「常識は（アル！）モラルは（ナイ！）」",
});

// 植民地の おみやげ（持ち帰る品。その板の マスコットに ゆかりの 物）
add({
	id: "kinonyan",
	cat: "goal",
	icon: art("kinonyan"), // 額に 入った AA（敵の 絵とは 別）
	name: "きのにゃんのAA",
	desc: "[ｷ・Д・ﾉ]　きのこ板の底でふんぞりかえっていた。持ち帰ろう",
	flavor: "態度がでかい。持ち帰ってもたぶんでかい",
});
add({
	id: "yashi",
	cat: "goal",
	icon: "sp:NwQNzoN", // RPGEN「ココナッツ　やしのみ」
	name: "山の上のヤシの実",
	desc: "離島・沖縄板の山の上に引っかかっていたヤシの実。持ち帰ろう",
	flavor: "ヤッシッシ～。島民は6人。拾ったのは7人目",
});
// おーぷぬの おんJ関連板の 品（2026-10-13）
add({
	id: "hoshi",
	cat: "goal",
	icon: art("hoshi"),
	name: "水星のかけら",
	desc: "マーキュリーのいちばん底で光っていた。持ち帰ろう",
	flavor: "おんJに飽きた人の、ほのぼのした温度",
});
add({
	id: "tojoken",
	cat: "goal",
	icon: art("tojoken"),
	name: "おんMu国際空港の搭乗券",
	desc: "沈んだ大陸の空港の、行き先のない搭乗券。持ち帰ろう",
	flavor: "「新境地への旅行はじめり」",
});
add({
	id: "kimchi",
	cat: "goal",
	icon: art("kimchi"),
	name: "おんキムのキムチ壺",
	desc: "管理部の奥で漬かっていた。持ち帰ろう",
	flavor: "植民地はふえても、キムチは1つ",
});
add({
	id: "grimoire",
	cat: "goal",
	icon: art("grimoire"),
	name: "†漆黒の魔導書†",
	desc: "闇の塔のてっぺんに封印されていた。持ち帰ろう",
	flavor: "読むと、14歳のころの自分がふりむく",
});
add({
	id: "takoyaki",
	cat: "goal",
	icon: art("takoyaki"),
	name: "屋上のたこ焼き",
	desc: "おんたこの屋上で焼けていた。😡の形をしている。持ち帰ろう",
	flavor: "怒っているのではない。焼けているだけ",
});
add({
	id: "uchiwa",
	cat: "goal",
	icon: "sp:SPpbIcP", // RPGEN「うちわ」
	name: "やぐらのうちわ",
	desc: "やぐらの上で、親分があおいでいたうちわ。持ち帰ろう",
	flavor: "降りてからも、まだあおいでいる",
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

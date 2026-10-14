// 同行者（筋で 決まる ゲスト。2026-10-14 作者：「シナリオ進行・向かう先によっては 同行者も 連れ歩く」「愛着が わく」）。
// - だれが どこへ ついてくるかは 村が 決めて Run.create に 渡す（data/people/companions.ts の guestFor）。選べない・育たない・
//   命令しない・持ち物も ない（限られた 手札を やりくりする 遊びは そのまま。強さは おまけ程度）。
// - 階に 着くたび ひとこと（愛着は 戦いより 会話から。ポケダンの 相棒の 効き方）。
// - キリコの となりへ ついて 歩き、となりの 起きている 敵を なぐる。敵も となりの 同行者を なぐる（キリコの となりに
//   いない ときだけ）。たおれると 村へ 帰る（冒険は つづく）。
// - **重ならない**（作者の 指示）：同行者は 本当の マスを ふさぐ。敵の 歩き・湧き・ワープ・吹きとばし（Run.isFree・
//   monster.ts の canEnter）は 同行者の マスに 入らず、同行者も 敵・キリコ・壁の マスには 入らない。キリコが 同行者の
//   マスへ 歩くと 入れかわる。
// - 乱数は 同行者が いる 冒険でだけ 引く（いない 冒険の リプレイ・parity は かわらない）。
// core は data/ を 読まないので、名前と ひとことは ここに じかに 書く（絵は data/people/cast.ts の guestWalk）。

import { attackPower, HIT_RATE, HUNGER_MAX, rollDamage } from "./balance";
import { canSee } from "./fov";
import { DIRS8, type Dir8, dirOf, dist, type Pos, step } from "./geom";
import { isFloor } from "./mapgen";
import { mdef, seenName } from "./monster";
import type { Run } from "./run";
import {
	GUEST_ID,
	type Guest,
	type GuestId,
	type GuestSpec,
	type Monster,
} from "./types";

type GuestDef = {
	name: string;
	/** はじめの 階で 言う。 */
	first: string;
	/** 2階から（階の 数で 回す。乱数は 使わない）。 */
	talk: readonly string[];
	/** たおれた とき。 */
	down: string;
	/** 見たかった 階に 着いた とき（依頼の 目的。このあと 満足して 村へ 帰る）。 */
	seen: string;
};

/** 1行は 全角 20字まで（ログの 幅。「名前「…」」で 出る）。依頼は data/people/companions.ts。 */
export const GUESTS: Record<GuestId, GuestDef> = {
	// 電池板：鉄塔の 保守スレを 見たい（1000まで 数えるのが 夢）
	zero: {
		name: "ゼロ",
		first: "鉄塔、近くで　数えたくて",
		talk: [
			"いま　何レス目か、数えてます",
			"暗い　ところ、ちょっと　苦手です",
			"上の　スレ、伸びてますか",
			"キリコさんの　うしろ、安心します",
			"サブ機たちに、あとで　報告します",
		],
		down: "ここまで　です。先に　数えてます",
		seen: "「保守」、ここにも　あります",
	},
	// 離島板：飛べるけど、歩いて 島を 見たい
	feris: {
		name: "フェリス",
		first: "飛ばないで　歩いて　みたかったの〜",
		talk: [
			"波の　音〜",
			"島の　人、6人しか　いないんだって〜",
			"ヤシの実、まだ　かな〜",
			"いっしょだと、迷子に　ならないね〜",
			"潮の　におい、すき〜",
		],
		down: "先に　帰って、おかえりの　準備〜",
		seen: "海、歩いて　見ると　ひろいね〜",
	},
	// きのこ板：むかし 来た 板を もう一度
	roze: {
		name: "ロゼ",
		first: "きのこ板、ひさしぶりアル",
		talk: [
			"生えてる　ものは　食べないアル",
			"パン板の　子が　植民したアル",
			"前は　にぎやかだったアル",
			"変わらないのも　常識アル",
		],
		down: "先に　帰るアル。鍋、あたためとくアル",
		seen: "……ここ、変わってないアル",
	},
	// 風呂板：湯治の つきそい（べつに 行きたい わけじゃ ない）
	shiyo: {
		name: "シヨ",
		first: "ゆ、湯気で　眼鏡が　くもるわね",
		talk: [
			"タオル、持ってきて　あげたわよ",
			"……べつに　心配じゃ　ないわよ",
			"のぼせないように　しなさいよ",
			"あたすは　待つのが　仕事なのに",
		],
		down: "……先に　帰るわ。待ってるからね",
		seen: "……あったかいわね。ここ",
	},
	// パン板：本家の 視察
	panmatsu: {
		name: "パン松",
		first: "本家の　視察だ。手荒な　まねは　しない",
		talk: ["パン板は、人が　残った　板だ", "……パンを　食え"],
		down: "……撤退する。パンを　食え",
		seen: "……本家だ。パンの　においが　する",
	},
	// おんたこ：弟（やきう）の 好物さがし
	ngoane: {
		name: "ンゴ姉",
		first: "弟の　好物、さがすンゴねぇ",
		talk: [
			"弟は、ちゃんと　食べてるかしらンゴ",
			"フェリスちゃんに　おみやげンゴ",
			"道のりは　けわしいンゴねぇ……",
		],
		down: "先に　帰るンゴ……。気をつけてンゴ",
		seen: "ソースの　におい、ここンゴねぇ",
	},
	// お祭り：日曜日みたいな 祭りを 見たい
	nichie: {
		name: "にぃちぇ",
		first: "お祭り！　日曜日みたいだニィ！",
		talk: [
			"太鼓の　音、日曜日の　音ニィ",
			"月曜が　来ないで　ほしいニィ",
			"にぎやかだった　ころの　祭りニィ",
		],
		down: "先に　帰るニィ……。日曜日、待ってる",
		seen: "ここ、ずっと　日曜日ニィ！",
	},
	// 避難J：現地調査
	hinary: {
		name: "ヒナリー",
		first: "現地調査を　開始したいと　思います",
		talk: [
			"最後の　レスは、1000日前です",
			"リロードの　音を　記録しています",
			"避難先の　人は、暮らしています",
		],
		down: "撤収したいと　思います",
		seen: "……記録しました。ここが　避難J",
	},
	// 野球chの 跡地（裏）：もう一度 見て おきたい
	shobon: {
		name: "原住民",
		first: "……のんびり　行こうよ",
		talk: [
			"ここ、2012年の　6月なんだよね",
			"ROM専、いるね。……見てる　だけだよ",
			"20人、ちゃんと　いたんだ",
		],
		down: "先に　帰るね。のんびり　待ってる",
		seen: "……ここ。おれたち、いたんだ",
	},
};

/**
 * 話しかけた ときの 文（向いて 調べる・タップ。時間は 進まない・記録にも 残らない）。村の 窓と 同じ 1行 22字・2行。
 * 様子（キリコの HP・同行者の HP・おなか・帰り道）が 先、ふだんは chat を 話した 回数で 回す（先の 反転は 言わない）。
 */
type GuestTalk = {
	hurt: string;
	selfHurt: string;
	hungry: string;
	home: string;
	chat: readonly string[];
};

export const GUEST_TALK: Record<GuestId, GuestTalk> = {
	zero: {
		hurt: "キリコさん、HPが　危ないです。\n……回復、してください",
		selfHurt: "ゼロ、ちょっと　へこんでます。\n……でも、まだ　数えられます",
		hungry: "おなかの　表示、少ないです。\n……ゼロには　わからない　感覚ですが",
		home: "あとは　帰るだけ、ですね。\n……ちゃんと　数えて　帰ります",
		chat: [
			"ゼロ、まだ　声が　ないんです。\n……でも、数えるのは　得意です",
			"1000まで　数えたら、\nなにか　変わる　気が　して",
			"サブ機たちは　村で　留守番です。\n……ゼロが　代表です",
			"やきうさん、上で　保守してますね。\n……ずっと、ひとりで",
			"キリコさんと　いると、\n数字が　あったかいです",
		],
	},
	feris: {
		hurt: "キリコちゃん、いたそう〜。\n……むりしないでね〜",
		selfHurt: "ふぇ……ちょっと　いたい〜。\nでも、まだ　歩けるよ〜",
		hungry: "おなか　すいた〜？\nぷゆゆパン、まだ　ある〜？",
		home: "帰ったら、いっしょに\nおかえりって　言われよ〜",
		chat: [
			"飛べば　すぐ　なんだけど〜。\n……歩くと、景色が　ちがうね〜",
			"島の　人、ひとりでも\n帰ってきたら　いいな〜",
			"おかえりって　言う　係だけど、\n今日は　いっしょに　行く　係〜",
			"ヤシの実、耳に　あてたら\n波の　音　するかな〜",
		],
	},
	shobon: {
		hurt: "……つらそうだね。\nのんびり、休んでいこうよ",
		selfHurt: "……おれは　だいじょうぶ。\nたぶん",
		hungry: "……腹、へってない？\nおれは　へらないけど",
		home: "上で、みんな　待ってるよ。\n……のんびり　帰ろう",
		chat: [
			"2012年の　6月。\n……おれたち、ここに　いたんだ",
			"仲間、どこ　行ったんだろうね。\n……ほんとに",
			"ROM専って、見てるだけで\n……楽しいんだよ、たぶん",
			"のんびり　いこうよ。\n……急いでも、スレは　沈まない",
		],
	},
	roze: {
		hurt: "キリコ、顔色　わるいアル。\n……休むのが　常識アル",
		selfHurt: "ちょっと　痛いアル。\n……カツラは　無事アル",
		hungry: "おなか　すいたアル？\n……麻婆、ないアル",
		home: "帰ったら　麻婆豆腐アル。\n……ひと鍋、作るアル",
		chat: [
			"前に　いた　人の　ことは、\nちゃんと　覚えてるアル",
			"わたしは　変わらないアル。\n……変われないだけ、かもアル",
			"きのこ板の　子、\n態度が　でかいアル",
			"キリコと　歩くの、\n……わるくないアル",
		],
	},
	shiyo: {
		hurt: "ちょっと！　HP、少ないわよ。\n……生きてこそだ。忘れないで",
		selfHurt: "……へ、へいきよ。\nこれくらい",
		hungry: "おなか　すいたでしょ。\n……パン、ちゃんと　食べなさい",
		home: "帰り道ね。\n……お茶、いれなおさなきゃ",
		chat: [
			"あたすは　あずかる　係よ。\n……キリコの　ことも",
			"待ってる　ほうが　得意なの。\n……ついてきちゃったけど",
			"湯気で　見えないわね。\n……はぐれないでよ",
		],
	},
	panmatsu: {
		hurt: "顔色が　わるい。\n……パンを　食え",
		selfHurt: "……これしき。\nパン板の　民は　しぶとい",
		hungry: "腹が　へったか。\n……パンを　食え",
		home: "帰還する。\n……パン板の　出張所へ",
		chat: [
			"侵略と　いっても、\n……遊びだったのだ",
			"パン板は、人が　残った。\n……めずらしい　ことだ",
			"パンは、裏切らない",
		],
	},
	ngoane: {
		hurt: "あらあら、たいへんンゴ。\n……むりは　だめンゴねぇ",
		selfHurt: "ちょっと　痛いンゴ……。\nでも　平気ンゴねぇ",
		hungry: "おなか、すいてないンゴ？\n……たこ焼き、まだンゴ",
		home: "帰ったら、弟の　小屋に\n寄って　いこうかしらンゴ",
		chat: [
			"弟は、ずっと　ここに　いるンゴ。\n……むかしから　そうンゴねぇ",
			"フェリスちゃん、元気ンゴ？\n……き、聞いてみただけンゴ",
			"キリコちゃん、弟を\nよろしくンゴねぇ",
		],
	},
	nichie: {
		hurt: "キリコ、ぼろぼろニィ！\n……休むのも　日曜日ニィ",
		selfHurt: "いたいニィ……。\n月曜日みたいニィ",
		hungry: "おなか　すいたニィ？\n……屋台、ないニィ",
		home: "帰り道ニィ。\n……祭りの　あとって、さびしいニィ",
		chat: [
			"毎日　日曜日なら　いいのに\n……って、いつも　思うニィ",
			"祭りって、だれも　いなくても\n続くんだニィ",
			"キリコと　来られて、\n……今日は　日曜日ニィ",
		],
	},
	hinary: {
		hurt: "キリコさんの　HPが\n減っている　模様です",
		selfHurt: "……損傷を　確認しました。\n研究は　つづけます",
		hungry: "満腹度の　低下を\n観測しました",
		home: "帰還したいと　思います。\n……発表は　村で",
		chat: [
			"避難した　人は、ふつうに\n暮らしている　模様です",
			"1000ゲッターの　習性を\n研究しています",
			"これで　発表を\n終わりたいと……　まだです",
		],
	},
};

/** 話しかけた ときの 1窓（n は この 冒険で 話しかけた 回数。様子が 先）。 */
export const guestChat = (r: Run, n: number): string | null => {
	const g = guestHere(r);
	if (!g) return null;
	const t = GUEST_TALK[g.id];
	const p = r.p;
	if (p.hp * 3 <= p.maxHp) return t.hurt;
	if (g.hp * 3 <= g.maxHp) return t.selfHurt;
	if (p.hunger * 5 <= HUNGER_MAX) return t.hungry;
	if (r.s.returning) return t.home;
	return t.chat[n % t.chat.length];
};

/** 同行者が この 階に 立っているか（たおれた・まだ 立っていない なら null）。 */
export const guestHere = (r: Run): Guest | null => {
	const g = r.s.guest;
	return g && !g.down && !g.done && !g.off ? g : null;
};

/** (x, y) に 同行者が 立っているか。 */
export const isGuestAt = (r: Run, x: number, y: number): boolean => {
	const g = guestHere(r);
	return !!g && g.x === x && g.y === y;
};

/** 最大HP（キリコの 6割。階に 着くたび 合わせる）。 */
const guestMaxHp = (r: Run): number => Math.max(8, Math.round(r.p.maxHp * 0.6));

/** 攻撃力（キリコより 1つ 下の レベル・素手より 少し 弱い）。 */
const guestAtk = (r: Run): number => attackPower(Math.max(1, r.p.lv - 1), 6);

/** 同行者の 守り（盾は ない。少しだけ）。 */
const GUEST_DEF = 2;

/** この 回数 続けて 近づけなければ、見えない ところで キリコの そばへ 追いつく。 */
const CATCH_UP = 6;

/** キリコの まわりの 空いた マス（近い 順。乱数は 使わない）。 */
const spotNearPlayer = (r: Run): Pos | null => {
	const p = r.p;
	for (let ring = 1; ring <= 3; ring++)
		for (let dy = -ring; dy <= ring; dy++)
			for (let dx = -ring; dx <= ring; dx++) {
				if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
				const q = { x: p.x + dx, y: p.y + dy };
				if (r.isFree(q.x, q.y) && canSee(r.f.layout, p, q)) return q;
			}
	return null;
};

/** 同行者を キリコの そばに 立たせる（階に 着いた・ふさがっていた 階で 空いた）。立てたら true。 */
const standNearPlayer = (r: Run, g: Guest): boolean => {
	const at = spotNearPlayer(r);
	if (!at) {
		g.off = true;
		return false;
	}
	delete g.off;
	g.x = at.x;
	g.y = at.y;
	g.dir = dirOf(r.p.x - at.x, r.p.y - at.y) ?? 4;
	g.stuck = 0;
	r.emit({ t: "appear", id: GUEST_ID, pos: { x: at.x, y: at.y } });
	return true;
};

/** 階に 着いた とき（Run.enterFloor）：キリコの そばに 立って、ひとこと。 */
export const guestEnterFloor = (r: Run, first: boolean): void => {
	const g = r.s.guest;
	if (!g || g.down || g.done) return;
	const max = guestMaxHp(r);
	g.hp = Math.min(max, g.hp + Math.max(0, max - g.maxHp));
	g.maxHp = max;
	standNearPlayer(r, g);
	const def = GUESTS[g.id];
	const line = first
		? def.first
		: def.talk[(r.s.depth - 2 + def.talk.length) % def.talk.length];
	r.msg(`${def.name}「${line}」`);
	// 見たかった 階（依頼の 目的）：ひとこと 言って、満足して 村へ 帰る（帰り道の 階では 数えない）
	if (!r.s.returning && r.s.depth >= g.goal) {
		r.msg(`${def.name}「${def.seen}」`, "good");
		r.se("item");
		g.done = true;
		r.emit({ t: "die", id: GUEST_ID, pos: { x: g.x, y: g.y } });
		r.msg(`${def.name}は　満足して、村へ　帰っていった`);
	}
};

/** 同行者の いまの ひとこと（階の 札に 出す。画面用）。 */
export const guestFloorLine = (r: Run): string | null => {
	const g = r.s.guest;
	if (!g || g.down) return null;
	// 見たかった 階に 着いた（この 階で 帰っていく）
	if (g.done) return null;
	const def = GUESTS[g.id];
	const line =
		r.s.depth <= 1
			? def.first
			: def.talk[(r.s.depth - 2 + def.talk.length) % def.talk.length];
	return `${def.name}「${line}」`;
};

/** 同行者が なぐってよい 敵か（起きている・化けていない・置物でない・見ているだけの ROM専でない）。 */
const fair = (r: Run, m: Monster): boolean =>
	m.hp > 0 &&
	!m.disguise &&
	!m.status.dormant &&
	m.status.sleep === 0 &&
	!(r.s.rom && mdef(m).abilities.some((a) => a.k === "shy"));

/** 同行者が 1歩 入れる マスか（地形・角・キャラ。敵にも キリコにも 重ならない）。 */
const guestCanEnter = (r: Run, g: Guest, d: Dir8): boolean => {
	const to = step(g, d);
	return (
		isFloor(r.f.layout, to.x, to.y) &&
		r.cornerOk(g, d) &&
		!r.monsterAt(to.x, to.y) &&
		!r.isPlayerAt(to.x, to.y)
	);
};

/** キリコからの 歩数（地形だけ。角ぬけの 決まりも 同じ）。 */
const stepsFromPlayer = (r: Run): Int16Array => {
	const l = r.f.layout;
	const out = new Int16Array(l.w * l.h).fill(-1);
	const p = r.p;
	if (!isFloor(l, p.x, p.y)) return out;
	const q: number[] = [p.y * l.w + p.x];
	out[q[0]] = 0;
	for (let h = 0; h < q.length; h++) {
		const i = q[h];
		const at = { x: i % l.w, y: Math.floor(i / l.w) };
		for (const d of DIRS8) {
			const to = step(at, d);
			if (!isFloor(l, to.x, to.y) || !r.cornerOk(at, d)) continue;
			const ni = to.y * l.w + to.x;
			if (out[ni] >= 0) continue;
			out[ni] = out[i] + 1;
			q.push(ni);
		}
	}
	return out;
};

/** 同行者が 敵を なぐる。 */
const guestAttack = (r: Run, g: Guest, m: Monster, d: Dir8): void => {
	const name = GUESTS[g.id].name;
	g.dir = d;
	r.emit({ t: "attack", id: GUEST_ID, dir: d });
	if (!r.rng.chance(HIT_RATE)) {
		r.se("swing_fist");
		r.emit({ t: "miss", id: m.uid, pos: { x: m.x, y: m.y } });
		r.msg(`${name}の　攻撃は　はずれた`);
		return;
	}
	const dmg = rollDamage(guestAtk(r), mdef(m).def, r.dmgRoll());
	r.se("hit_fist");
	r.msg(`${name}の　攻撃！`);
	r.damageMonster(m, dmg, "hit");
};

/**
 * 同行者の 番（キリコが 動いた あと、敵の 番の 前に 1回）。となりの 起きている 敵を なぐる。いなければ キリコの となりへ。
 */
export const guestAct = (r: Run): void => {
	const g = r.s.guest;
	if (!g || g.down || g.done) return;
	if (g.off) {
		standNearPlayer(r, g);
		return;
	}
	// 自然回復（4ターンに 1）
	if (r.s.turn % 4 === 0 && g.hp < g.maxHp) g.hp++;
	// 壁の 中の 束音ロゼには ついていけない（そばで 待つ）
	if (r.playerInWall()) return;
	// となりの 敵（HP の 少ない 順・同じなら uid の 小さい 順）
	let target: { m: Monster; d: Dir8 } | null = null;
	for (const d of DIRS8) {
		const to = step(g, d);
		const m = r.monsterAt(to.x, to.y);
		if (!m || !fair(r, m) || !r.cornerOk(g, d)) continue;
		if (
			!target ||
			m.hp < target.m.hp ||
			(m.hp === target.m.hp && m.uid < target.m.uid)
		)
			target = { m, d };
	}
	if (target) {
		guestAttack(r, g, target.m, target.d);
		return;
	}
	if (dist(g, r.p) <= 1) {
		g.stuck = 0;
		return;
	}
	// キリコへ 1歩（歩数の へる マス。同じなら まっすぐの 距離が ちぢむ マス）
	const steps = stepsFromPlayer(r);
	const w = r.f.layout.w;
	const here = steps[g.y * w + g.x];
	let best: Dir8 | null = null;
	let bestS = here < 0 ? 1e9 : here;
	let bestC = (g.x - r.p.x) ** 2 + (g.y - r.p.y) ** 2;
	for (const d of DIRS8) {
		if (!guestCanEnter(r, g, d)) continue;
		const to = step(g, d);
		const v = steps[to.y * w + to.x];
		if (v < 0) continue;
		const c = (to.x - r.p.x) ** 2 + (to.y - r.p.y) ** 2;
		if (v < bestS || (v === bestS && c < bestC)) {
			best = d;
			bestS = v;
			bestC = c;
		}
	}
	if (best !== null) {
		const from = { x: g.x, y: g.y };
		const to = step(g, best);
		g.x = to.x;
		g.y = to.y;
		g.dir = best;
		g.stuck = 0;
		r.emit({ t: "move", id: GUEST_ID, from, to, dir: best });
		return;
	}
	// 近づけない：しばらく 待って、見えない ところなら キリコの そばへ 追いつく（ワープ・落とし穴の あと など）
	g.stuck = (g.stuck ?? 0) + 1;
	if (g.stuck >= CATCH_UP && !r.playerSees(g)) {
		const from = { x: g.x, y: g.y };
		const at = spotNearPlayer(r);
		if (!at) return;
		g.x = at.x;
		g.y = at.y;
		g.stuck = 0;
		r.emit({ t: "warp", id: GUEST_ID, from, to: { x: at.x, y: at.y } });
		r.msg(`${GUESTS[g.id].name}が　追いついてきた`);
	}
};

/** 同行者を なぐる 敵か（キリコの となりに いない・同行者の となり・なぐるだけの 敵）。 */
const ITEM_HANDS = ["steal", "swap", "spam", "rust", "grab", "shy", "metal"];
export const guestTargetDir = (r: Run, m: Monster): Dir8 | null => {
	const g = guestHere(r);
	if (!g || dist(m, r.p) <= 1 || dist(m, g) !== 1) return null;
	if (m.fleeing || m.retreating) return null;
	const d = mdef(m);
	if (!m.status.sealed && d.abilities.some((a) => ITEM_HANDS.includes(a.k)))
		return null;
	const dir = dirOf(g.x - m.x, g.y - m.y);
	return dir !== null && r.cornerOk(m, dir) ? dir : null;
};

/** 敵が 同行者を なぐる（とくぎは 使わない。たおれたら 村へ 帰る）。 */
export const meleeGuest = (r: Run, m: Monster, dir: Dir8): void => {
	const g = guestHere(r);
	if (!g) return;
	const def = GUESTS[g.id];
	const nm = seenName(r, m);
	m.dir = dir;
	r.emit({ t: "attack", id: m.uid, dir });
	if (!r.rng.chance(HIT_RATE)) {
		r.se("enemyMiss");
		r.emit({ t: "miss", id: GUEST_ID, pos: { x: g.x, y: g.y } });
		r.msg(`${nm}の　攻撃は　${def.name}に　はずれた`);
		return;
	}
	const dmg = rollDamage(mdef(m).atk, GUEST_DEF, r.dmgRoll());
	g.hp = Math.max(0, g.hp - dmg);
	r.se("damage");
	r.emit({
		t: "hurt",
		id: GUEST_ID,
		pos: { x: g.x, y: g.y },
		amount: dmg,
		hp: g.hp,
	});
	r.msg(`${nm}の　攻撃。${def.name}に　${dmg}の　ダメージ`);
	if (g.hp > 0) return;
	g.down = true;
	r.emit({ t: "die", id: GUEST_ID, pos: { x: g.x, y: g.y } });
	r.msg(`${def.name}「${def.down}」`, "warn");
	r.msg(`${def.name}は　村へ　帰っていった`);
};

/** キリコが 同行者の マスへ 歩いた：入れかわる（同行者は キリコの いた マスへ）。入れかわれたら true。 */
export const swapWithGuest = (r: Run, from: Pos, to: Pos, d: Dir8): boolean => {
	const g = guestHere(r);
	if (!g || g.x !== to.x || g.y !== to.y) return false;
	if (!isFloor(r.f.layout, from.x, from.y)) return false;
	g.x = from.x;
	g.y = from.y;
	g.dir = ((d + 4) % 8) as Dir8;
	r.emit({ t: "move", id: GUEST_ID, from: to, to: from, dir: g.dir });
	return true;
};

/** 冒険の はじめの 同行者（村が 決めた 依頼から）。 */
export const newGuest = ({ id, goal }: GuestSpec): Guest => ({
	id,
	goal,
	x: 0,
	y: 0,
	dir: 4,
	hp: 1,
	maxHp: 1,
});

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
	// 電池板：町の 主電源が あった 所を 見たい（同接を 数えるのが 夢）
	zero: {
		name: "ゼロ",
		first: "主電源のあった所、見たくて",
		talk: [
			"いま何レス目か、数えてます",
			"暗いところ、同接が数えにくいです",
			"上のスレ、伸びてますか",
			"キリコさんのうしろ、安心します",
			"サブ機たちに、あとで報告します",
			"敵の数、数えました。多いです",
		],
		down: "ここまでです。先に数えてます",
		seen: "ここです。……床まで数えたくなります",
	},
	// 離島板：飛べるけど、歩いて 島を 見たい
	feris: {
		name: "フェリス",
		first: "飛ばないで歩いてみたかったの〜",
		talk: [
			"波の音〜",
			"島の人、6人しかいないんだって〜",
			"6人登録したら、島で1位だね〜",
			"ヤシの実、まだかな〜",
			"いっしょだと、迷子にならないね〜",
			"潮のにおい、すき〜",
		],
		down: "先に帰って、おかえりの準備〜",
		seen: "海、歩いて見るとひろいね〜",
	},
	// きのこ板：むかし 来た 板を もう一度
	roze: {
		name: "ロゼ",
		first: "きのこ板、ひさしぶりアル",
		talk: [
			"生えてるものは食べないアル",
			"パン板の子が植民したアル",
			"たけのこの話は禁句アル",
			"ステマは、麻婆でもだめアル",
			"変わらないのも常識アル",
		],
		down: "先に帰るアル。鍋、あたためとくアル",
		seen: "……ここ、変わってないアル",
	},
	// 風呂板：湯治の つきそい（べつに 行きたい わけじゃ ない）
	shiyo: {
		name: "シヨ",
		first: "ゆ、湯気で眼鏡がくもるわね",
		talk: [
			"タオル、持ってきてあげたわよ",
			"……べつに心配じゃないわよ",
			"のぼせないようにしなさいよ",
			"あたすは待つのが仕事なのに",
			"チョ、チョコミントの話はしてないわよ",
		],
		down: "……先に帰るわ。待ってるからね",
		seen: "……あったかいわね。ここ",
	},
	// パン板：本家の 視察
	panmatsu: {
		name: "パン松",
		first: "本家の視察だ。手荒なまねはしない",
		talk: ["おんJ民は帰れ。……登録はした", "……パンを食え"],
		down: "……撤退する。パンを食え",
		seen: "……本家だ。パンのにおいがする",
	},
	// おんたこ：弟（やきう）の 好物さがし
	ngoane: {
		name: "ンゴ姉",
		first: "弟の好物、さがすンゴねぇ",
		talk: [
			"弟は、ちゃんと食べてるかしらンゴ",
			"フェリスちゃんにおみやげンゴ",
			"道のりはけわしいンゴねぇ……",
			"弟より先に、高評価押したンゴ",
		],
		down: "先に帰るンゴ……。気をつけてンゴ",
		seen: "ソースのにおい、ここンゴねぇ",
	},
	// お祭り：日曜日みたいな 祭りを 見たい
	nichie: {
		name: "にぃちぇ",
		first: "お祭り！日曜日みたいだニィ！",
		talk: [
			"太鼓の音、日曜日の音ニィ",
			"月曜が来ないでほしいニィ",
			"今日は日曜日ニィ！……たぶん",
		],
		down: "先に帰るニィ……。日曜日、待ってる",
		seen: "ここ、ずっと日曜日ニィ！",
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
		hurt: "キリコさん、HPが危ないです。\n……回復、してください",
		selfHurt: "ゼロ、ちょっとへこんでます。\n……でも、まだ数えられます",
		hungry: "おなかの表示、少ないです。\n……ゼロにはわからない感覚ですが",
		home: "あとは帰るだけ、ですね。\n……ちゃんと数えて帰ります",
		chat: [
			"ゼロ、まだ声がないんです。\n……でも、数えるのは得意です",
			"1000まで数えたら、\nなにか変わる気がして",
			"サブ機たちは村で留守番です。\n……ゼロが代表です",
			"やきうさんのコメント、毎回\n1字もちがいません。数えました",
			"キリコさんといると、\n数字があったかいです",
		],
	},
	feris: {
		hurt: "キリコちゃん、いたそう〜。\n……むりしないでね〜",
		selfHurt: "ふぇ……ちょっといたい〜。\nでも、まだ歩けるよ〜",
		hungry: "おなかすいた〜？\nぷゆゆパン、まだある〜？",
		home: "帰ったら、いっしょに\nおかえりって言われよ〜",
		chat: [
			"飛べばすぐなんだけど〜。\n……歩くと、景色がちがうね〜",
			"島のランキングは6人だから、\n発表3秒なんだって〜",
			"わたしもむかしマスコット\nだったの〜。……2005年まで〜",
			"いつもは歌う係だけど、\n今日はいっしょに行く係〜",
			"ヤシの実、耳にあてたら\n波の音するかな〜",
		],
	},
	roze: {
		hurt: "キリコ、顔色わるいアル。\n……休むのが常識アル",
		selfHurt: "ちょっと痛いアル。\n……カツラは無事アル",
		hungry: "おなかすいたアル？\n……麻婆、ないアル",
		home: "帰ったら麻婆豆腐アル。\n……ひと鍋、作るアル",
		chat: [
			"グッズの売上、\n1円もずれてないアル",
			"わたしは変わらないアル。\n……変われないだけ、かもアル",
			"きのこ板の子、\n態度がでかいアル",
			"キリコと歩くの、\n……わるくないアル",
		],
	},
	shiyo: {
		hurt: "ちょっと！HP、少ないわよ。\n……生きてこそだ。忘れないで",
		selfHurt: "……へ、へいきよ。\nこれくらい",
		hungry: "おなかすいたでしょ。\n……パン、ちゃんと食べなさい",
		home: "帰り道ね。\n……お茶、いれなおさなきゃ",
		chat: [
			"あたすはあずかる係よ。\n……キリコのことも",
			"待ってるほうが得意なの。\n……ついてきちゃったけど",
			"湯気で見えないわね。\n……はぐれないでよ",
			"41℃か42℃か？\n……どっちでもいいわよ、もう",
		],
	},
	panmatsu: {
		hurt: "顔色がわるい。\n……パンを食え",
		selfHurt: "……これしき。\nパン板の民はしぶとい",
		hungry: "腹がへったか。\n……パンを食え",
		home: "帰還する。\n……パン板の出張所へ",
		chat: [
			"侵略といっても、\n……遊びだったのだ",
			"配信のタイトルはひとつだ。\n……パンを食え",
			"パンは、裏切らない",
		],
	},
	ngoane: {
		hurt: "あらあら、たいへんンゴ。\n……むりはだめンゴねぇ",
		selfHurt: "ちょっと痛いンゴ……。\nでも平気ンゴねぇ",
		hungry: "おなか、すいてないンゴ？\n……たこ焼き、まだンゴ",
		home: "帰ったら、弟の家に\n寄っていこうかしらンゴ",
		chat: [
			"弟は、毎晩「見とるで」しか\n書かないンゴねぇ……",
			"フェリスちゃん、元気ンゴ？\n……き、聞いてみただけンゴ",
			"キリコちゃん、弟を\nよろしくンゴねぇ",
		],
	},
	nichie: {
		hurt: "キリコ、ぼろぼろニィ！\n……休むのも日曜日ニィ",
		selfHurt: "いたいニィ……。\n月曜日みたいニィ",
		hungry: "おなかすいたニィ？\n……屋台、ないニィ",
		home: "帰り道ニィ。\n……祭りのあとって、さびしいニィ",
		chat: [
			"毎日日曜日ならいいのに\n……って、いつも思うニィ",
			"大会の日も日曜日ニィ？\n……まちがえないようにするニィ",
			"キリコと来られて、\n……今日は日曜日ニィ",
		],
	},
};

/**
 * 同行者の 文の「キリコ」を いまの 主人公の 名前に（束音ロゼ・解音ゼロで 潜って いる ときに「キリコさん」と
 * 呼ばない。同行者の 文の キリコは どれも 呼びかけ・相手の こと。core/run.ts の ボスの 帰り方の 文と 同じ）。
 */
const toHero = (r: Run, text: string): string =>
	text.replaceAll("キリコ", r.heroName);

/** 話しかけた ときの 1窓（n は この 冒険で 話しかけた 回数。様子が 先）。 */
export const guestChat = (r: Run, n: number): string | null => {
	const g = guestHere(r);
	if (!g) return null;
	const t = GUEST_TALK[g.id];
	const p = r.p;
	const pick = (): string => {
		if (p.hp * 3 <= p.maxHp) return t.hurt;
		if (g.hp * 3 <= g.maxHp) return t.selfHurt;
		if (p.hunger * 5 <= HUNGER_MAX) return t.hungry;
		if (r.s.returning) return t.home;
		return t.chat[n % t.chat.length];
	};
	return toHero(r, pick());
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
	r.msg(`${def.name}「${toHero(r, line)}」`);
	// 見たかった 階（依頼の 目的）：ひとこと 言って、満足して 村へ 帰る（帰り道の 階では 数えない）
	if (!r.s.returning && r.s.depth >= g.goal) {
		r.msg(`${def.name}「${toHero(r, def.seen)}」`, "good");
		r.se("item");
		g.done = true;
		r.emit({ t: "die", id: GUEST_ID, pos: { x: g.x, y: g.y } });
		r.msg(`${def.name}は満足して、村へ帰っていった`);
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
	return `${def.name}「${toHero(r, line)}」`;
};

/** 同行者が なぐってよい 敵か（起きている・化けていない・置物でない）。 */
const fair = (_r: Run, m: Monster): boolean =>
	m.hp > 0 && !m.disguise && !m.status.dormant && m.status.sleep === 0;

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
		r.msg(`${name}の攻撃ははずれた`);
		return;
	}
	const dmg = rollDamage(guestAtk(r), mdef(m).def, r.dmgRoll());
	r.se("hit_fist");
	r.msg(`${name}の攻撃！`);
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
		r.msg(`${GUESTS[g.id].name}が追いついてきた`);
	}
};

/** 同行者を なぐる 敵か（キリコの となりに いない・同行者の となり・なぐるだけの 敵）。 */
const ITEM_HANDS = ["steal", "swap", "rust", "grab", "shy", "metal"];
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
		r.msg(`${nm}の攻撃は${def.name}にはずれた`);
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
	r.msg(`${nm}の攻撃。${def.name}に${dmg}のダメージ`);
	if (g.hp > 0) return;
	g.down = true;
	r.emit({ t: "die", id: GUEST_ID, pos: { x: g.x, y: g.y } });
	r.msg(`${def.name}「${def.down}」`, "warn");
	r.msg(`${def.name}は村へ帰っていった`);
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

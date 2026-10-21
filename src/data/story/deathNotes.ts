// たおれた ときの 死因の 一文（「〈要因〉で〈結果〉した」。マイクラの 死亡ログ・ローグの 墓石のように 少し 皮肉に）。
// 記録・リプレイには もとの 死因（Ending.cause：「ぷゆゆにたおされた」など）を そのまま 残し、見せる ときに ここで 作りかえる
// （replayMatches が 死因の 文字で 結ぶ ので、残す 文字は 変えない）。どれに なるかは 死因・ターン・階で 決まる（乱数は 引かない）。
// 階の 名前は 呼ぶ 側が 前に 足す（「B3　」）。1行 全角 22字 まで。

import { DUNGEONS } from "../../core/data/dungeons";
import { MONSTER_LIST, MONSTERS } from "../../core/data/monsters";
import { defOf, isKnownKind } from "../../core/item";
import type { DungeonId, RunState } from "../../core/types";

export type DeathCtx = {
	cause: string;
	depth: number;
	turn: number;
	/** たおれた ときの レベル（リプレイには 無い）。 */
	lv?: number;
	dungeon?: DungeonId;
};

/** 敵ごとの 決め手（{m} は 敵の 名前）。無い 敵は GENERIC から。 */
const BY_MONSTER: Record<string, readonly string[]> = {
	ぷゆゆ: ["ぷゆゆへの手のふり返しで死んだ", "2ターンに1回のぷゆゆで力つきた"],
	忘れスレの霊: ["忘れスレの霊を成仏させずに成仏した"],
	夏休みキッズ: ["夏休みキッズの無計画な突進で退場した"],
	ROM専: [
		"ROM専の初書きこみが訃報だった",
		"ROM専の10年越しの初書きこみで死んだ",
	],
	kskボット: ["kskボットの加速でスレごと流された"],
	寝落ち民: ["寝落ち民を起こしたせいで永眠した"],
	ピッチャー: ["ピッチャーの顔面ストライクで退場した"],
	にょっす牛: ["にょっす牛の「きちーｗ」で散った"],
	コピペ: ["増えたコピペの数の暴力で埋もれた"],
	ゾンJ民: ["ゾンJ民より先に本当に引退した"],
	拾い画UFO: ["拾い画UFOに道具ごと回収された"],
	風吹けば名無し: ["風吹けば名無しで桶屋がもうかった"],
	自演くん: ["自演くんと通りすがり（本人）で散った"],
	転載ガモ: ["転載ガモに死にざまを無断転載された"],
	鋼メンタル: ["鋼メンタルより先に心が折れた"],
	風呂キャンセル界隈: ["風呂キャンセル界隈のにおいで昇天した"],
	メタルぷゆゆ: ["狩るはずのメタルぷゆゆに狩られた"],
	VIPPER: ["VIPPERの4人（1人はおんJ民）で沈んだ"],
	置物: ["置物のとなりに立ってみた（非推奨）"],
	炎上案件: ["炎上案件の火消しでいちばん燃えた"],
	論破厨: ["論破厨に議論ぬきで論破された"],
	忍法帖エラー: ["「忍法帖が破損しました」の1行で死んだ"],
	かまってちゃん: ["かまってちゃんに看取られて実況された"],
	釣り: ["釣りに釣られて「乙」と言われた"],
	透明あぼーん: ["NGにした透明あぼーんで死んだ"],
	顔真っ赤: ["顔真っ赤に負けてこっちが真っ赤"],
	特定班: ["特定班に死因まで特定された"],
	文字化け: ["文字化けで縺溘♀繧後◆"],
	連投荒らし: ["連投荒らしで成仏した。成仏した"],
	粘着アンチ: ["粘着アンチに死後も粘着されている"],
	"ワイ バーン": ["ワイ バーンに質問して炎で回答された"],
	パン兵: ["お代がわりの命をパン兵に取られた"],
	きのにゃん: ["きのにゃんに見下ろされて散った"],
	おふ郎くん: ["おふ郎くんの湯気で湯あたりした"],
	でんちゃん: ["でんちゃんの残量1%に負けた"],
	ナツコ: ["人見知りのナツコに追いつめられた"],
	たこのみん: ["たこのみんで中までアツアツにされた"],
	マシー: ["マシーたち4人に開拓された"],
	パン兵長: ["パン兵長の号令で退場した"],
	親玉きのにゃん: ["親玉きのにゃんで苗床になった"],
	怒れるナツコ: ["怒れるナツコのヤシの実で散った"],
	大たこのみん: ["大たこのみんの鉄板で焼きあがった"],
	祭りの親分マシー: ["祭りの親分マシーのうちわで退場した"],
	湯守おふ郎くん: ["湯守おふ郎くんの42℃で茹であがった"],
	やきう: ["やきうのスレで「死んでて草」された", "やきうのスレのネタにされた"],
	削除人: ["削除人に記録ごと削除された"],
};

/** どの 敵にも 使える 決め手。 */
const GENERIC: readonly string[] = [
	"{m}で名無しに戻った",
	"{m}にからまれて退場した",
];

/** 吐く 攻撃（「〜の胞子でたおれた」）。{m} 敵・{w} 吐いた もの。 */
const BREATH: Record<string, readonly string[]> = {
	胞子: ["{m}の胞子で苗床になった"],
	熱々のたこ焼き: ["{m}のたこ焼きで焼きあがった"],
	炎: ["{m}の炎でこんがりした"],
};

/** 吹きとばされて 壁に ぶつかった（{m} 敵）。 */
const BLOWN: Record<string, readonly string[]> = {
	論破厨: ["論破厨の物理論破で壁にめりこんだ"],
	パン兵長: ["パン兵長に壁のシミにされた"],
	祭りの親分マシー: ["親分マシーのうちわで壁のシミになった"],
};
const BLOWN_GENERIC: readonly string[] = ["{m}の風圧で壁と一体化した"];

/** 決まった 文の 死因。 */
const FIXED: Record<string, readonly string[]> = {
	おなかがすいてたおれた: [
		"腹が減っては板めぐりできなかった",
		"{turn}ターンの断食で餓死した",
	],
	地雷を踏みぬいてたおれた: [
		"見えている地雷で爆死した",
		"踏んだら地雷だった（定期）",
	],
	落とし穴に落ちてたおれた: ["落とし穴の近道で成仏した"],
	炎上案件の爆発に巻きこまれた: [
		"他人の炎上で燃えつきた",
		"炎上案件の延焼で燃えつきた",
	],
	チギュリパンにあたった: ["カビたパンを残さず食べて力つきた"],
	// 荒らし草（HP 1 で 耐える）・諸刃の杖（HP の 半分を 切り上げて 残す）では いまは たおれないので この 2つは 出ない
	// （core/effects.ts）。hurtPlayer に 死因として 渡して いるので、決まりが かわった ときの ために 文は 残す
	荒らし草を飲んだ: ["荒らし草の一気飲みで散った"],
	諸刃の杖でたおれた: ["自分で振った諸刃の杖で散った"],
	冒険をやめた: ["そっ閉じで冒険をやめた"],
};

/** 罠の 死球（「ピッチングマシンの死球でたおれた」）。{t} 罠。 */
const PITCH: readonly string[] = [
	"{t}の死球で退場した",
	"{t}の危険球で退場した",
];

/** 弱い 敵（出る 階が 浅く 経験値が 3 まで）。 */
const WEAK = new Set(
	MONSTER_LIST.filter((d) => d.exp <= 3 && !d.boss).map((d) => d.name),
);

/** 弱い 敵に レベルが 高い まま たおされた。 */
const UPSET: readonly string[] = ["Lv{lv}の油断で{m}に負けた"];
/** はじまって すぐ たおれた。 */
const QUICK: readonly string[] = ["{turn}ターン目の{m}で即落ちした"];
/** 1階で たおされた。 */
const FIRST_FLOOR: readonly string[] = ["{m}で1階RTAを完走した"];
/** レベルが 高いのに 飢えた。 */
const LV_STARVE = "Lv{lv}でも腹は減ると知った";
/** キリ番の ターンで たおれた。 */
const KIRIBAN = "キリ番{turn}ターンを踏んで死んだ";
/** 長く もぐって たおれた。 */
const LONG_RUN = "{turn}ターンの長編がここで完結した";
/** パン板で 飢えた。 */
const BREAD_STARVE = "パンの国のど真ん中で餓死した";

/** 文字列と 数から 32bit の値（同じ 入力なら いつも 同じ）。 */
const hash = (s: string, n: number): number => {
	let h = (n | 0) ^ 0x811c9dc5;
	for (let i = 0; i < s.length; i++)
		h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
	h ^= h >>> 15;
	return Math.imul(h, 0x2c1b3c6d) >>> 0;
};

const fillIn = (t: string, v: Record<string, string | number>): string =>
	t.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));

/** 死因の 一文（「B3　」の あとに つづく ところ）。知らない 死因は もとの まま。 */
export const deathNote = (x: DeathCtx): string => {
	const c = x.cause.replaceAll("　", "");
	const h = hash(c, x.turn * 131 + x.depth);
	const one = (pool: readonly string[], v: Record<string, string | number>) =>
		fillIn(pool[h % pool.length], { turn: x.turn, lv: x.lv ?? "", ...v });

	if (c !== "冒険をやめた") {
		if (x.turn >= 100 && x.turn % 100 === 0) return one([KIRIBAN], {});
		if (x.turn >= 5000 && h % 3 === 0) return one([LONG_RUN], {});
	}
	const fixed = FIXED[c];
	if (fixed) {
		if (c.startsWith("おなかが") && x.dungeon === "shallow" && h % 2 === 0)
			return BREAD_STARVE;
		if (c.startsWith("おなかが") && (x.lv ?? 0) >= 10 && h % 3 === 0)
			return one([LV_STARVE], {});
		return one(fixed, {});
	}
	const pitch = c.match(/^(.+)の死球でたおれた$/);
	if (pitch) return one(PITCH, { t: pitch[1] });
	const breath = c.match(/^(.+)の(胞子|熱々のたこ焼き|炎)でたおれた$/);
	if (breath) return one(BREATH[breath[2]], { m: breath[1], w: breath[2] });
	const blown = c.match(/^(.+)に吹きとばされた$/);
	if (blown) return one(BLOWN[blown[1]] ?? BLOWN_GENERIC, { m: blown[1] });
	const hit = c.match(/^(.+)にたおされた$/);
	if (hit) {
		const m = hit[1];
		// 皮肉は ときどき（いつも だと 天丼に ならない）
		if (WEAK.has(m) && (x.lv ?? 0) >= 5 && h % 2 === 0)
			return one(UPSET, { m });
		if (x.turn <= 30 && m.length <= 6 && h % 3 === 0) return one(QUICK, { m });
		if (x.depth === 1 && m.length <= 7 && h % 3 === 1)
			return one(FIRST_FLOOR, { m });
		return one(BY_MONSTER[m] ?? GENERIC, { m });
	}
	return x.cause;
};

// ───────────────── めずらしい たおれ方 ─────────────────
// たおれた ときの 冒険の ようす（RunState）から 見つける 1つきりの 一文。あれば ふつうの 一文より 先に 出す。
// 記録には この 文を そのまま 残す（RunRecord.note。リプレイには 残さない）。上から 順に 見る。

/** 前の 冒険から わかる こと（記録を 読む 側が 渡す。リプレイでは 渡さない）。 */
export type DeathPast = {
	/** この 板の ボスを 前に たおした ことが ある。 */
	bossBeaten?: boolean;
};

const near = (a: { x: number; y: number }, b: { x: number; y: number }) =>
	Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** めずらしい たおれ方の 一文（無ければ null）。 */
export const deathSpecial = (
	s: RunState,
	past: DeathPast = {},
): string | null => {
	const end = s.end;
	if (end?.kind !== "dead") return null;
	const c = end.cause.replaceAll("　", "");
	if (c === "冒険をやめた") return null;
	const p = s.player;
	const f = s.floor;
	const dg = DUNGEONS[s.dungeon];
	const fell = c.startsWith("落とし穴");
	const starved = c.startsWith("おなかが");
	const killer = c.match(
		/^(.+?)(?:にたおされた|の.+でたおれた|に吹きとばされた)$/,
	)?.[1];
	const of = (kind: string) => p.items.filter((it) => it.kind === kind).length;
	const ring = p.items.find((it) => it.uid === p.ring)?.kind;
	const goalName = defOf(dg.goal).name;

	const boss = dg.boss && MONSTERS[dg.boss.monster]?.name;
	if (boss && killer === boss && past.bossBeaten)
		return `${boss}にリベンジされた`;
	if (f.monsters.some((m) => m.kind === "ufo" && m.carry?.kind === dg.goal))
		return `${[...goalName].length <= 8 ? goalName : "目当ての品"}は拾い画UFOが持っている`;
	if (killer === "釣り" && ring === "r_trap")
		return "◆釣られないを着けて釣られた";
	if (starved && ring === "r_hunger") return "◆大食いを外さずに餓死した";
	const kd = killer && MONSTER_LIST.find((d) => d.name === killer);
	const slain = kd ? (s.kills[kd.id] ?? 0) : 0;
	if (kd && slain >= 10)
		return kd.name.length <= 5 && slain < 100
			? `${kd.name}を${slain}体たおして${slain + 1}体目に負けた`
			: `${slain + 1}体目の${kd.name}に負けた`;
	if (starved) {
		const food = p.items.find((it) => defOf(it.kind).cat === "food");
		if (food) {
			const n = of(food.kind);
			const name = defOf(food.kind).name;
			return n >= 3
				? `${name}を${n}個持って餓死した`
				: `${name}を持ったまま餓死した`;
		}
		const swapper = f.monsters.find((m) => m.kind === "panhei" && m.swapped);
		if (swapper) return "パンと引きかえた持ち物ごと餓死した";
	}
	// 正体を 知らない まま 持っていた ときだけ（知っていて 読まないのは よく ある）
	if (of("s_escape") && !isKnownKind(s, "s_escape"))
		return "読まなかった巻物が帰還スレだった";
	if (f.res >= 990) return `あと${1000 - f.res}レスでdat落ちに逃げこめた`;
	if (s.returning && end.depth === 1)
		return goalName.length <= 6
			? `${goalName}を抱えて地上の手前で散った`
			: "地上の1つ手前で品ごと散った";
	if (!s.returning && s.objective !== "boss") {
		const goal = f.items.find(
			(fi) => fi.item.kind === dg.goal && near(fi, p) <= 1,
		);
		if (goal) return `${goalName}まであと1歩だった`;
	}
	if (starved && p.status.sleep > 0) return "寝たまま餓死した";
	const herbs = of("h_heal");
	if (herbs >= 5) return `草を${herbs}つ残して散った`;
	// 帰り道は 階段の 向きが 逆（下りの 板なら 上り）
	if (!fell && near(f.stairs, p) === 0)
		return !!dg.up !== s.returning
			? "階段に立ったまま上らなかった"
			: "階段に立ったまま降りなかった";
	if (!fell && end.depth > 1 && f.turns <= 1)
		return `着いて${f.turns}ターンで散った`;
	if (end.depth >= 3 && Object.values(s.kills).every((n) => !n))
		return "1体もたおさず平和的にやられた";
	if (end.depth >= 4 && s.stats.itemsUsed === 0)
		return "道具を1つも使わずに散った";
	if (p.lv === 1 && end.depth >= 4) return "Lv1で来てLv1のまま散った";
	if (p.weapon === null && p.shield === null && end.depth >= 7)
		return "素手と私服で来て私服で散った";
	if (!fell && near(f.stairs, p) === 1) return "階段まであと1歩だった";
	return null;
};

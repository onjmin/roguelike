// 安価（前の レスで 取られた「>>今の レス番　が　草を　1つ　飲む」。2ch の 安価の 形）。スレ民からの お題。
//
// - 2階から、階に 入ったとき 安価の罠を ANKA_TRAPS 個 隠して 置く。踏むと 安価が 来て、罠は 消える
//   （1回きり。同じ 罠で 何度も 安価を 呼べない）。見つけて よければ 来ない。
//   釣りスレで ふえる 罠も ANKA_SNARE_CHANCE で 安価の罠に なる。安価が 出ている うちは 踏んでも 動かず 残る。
// - お題は その時の 持ち物で できる ものから 選ぶ（草が なければ「草を　1つ　飲む」は 来ない）。
//   むずかしい お題（寝る・攻撃を 受ける・罠・レベル など）は 来にくい（doable の 重み）。
// - ANKA_DUE レス 以内に こなせば 神安価：スレ民が この板の 道具を ANKA_GIFTS 個（正体つき）足元に 置く。
// - 守らなければ スレが 荒れる：レスが ANKA_PENALTY 伸び、階の 敵が みんな 目を さまし、荒らしが ANKA_TROLLS 体 湧く
//   （ボスが 生きている 階には 湧かない）。
// - 帰り道には 来ない（帰り道は 補給なし）。ボスの 待つ 階にも 来ない（湧かないので 敵を たおす お題が こなせない）。
// - 出ている 安価は 階を かわっても 消えない（次スレに 持ちこし。のこりの レス数も そのまま）。

import { EXP_AT, MAX_LV } from "./balance";
import { freeRoomTiles, randomFloorPos, spawnMonster } from "./floor";
import {
	defOf,
	identifyKind,
	isKeyItem,
	isKnownKind,
	itemHidden,
	itemTableOf,
} from "./item";
import { rollKinds } from "./itemTable";
import { wakeMonster } from "./monster";
import type { Run } from "./run";
import type { Anka, AnkaKind, Floor } from "./types";

/**
 * 階に 入ったとき 置く 安価の罠の 数。踏むかは 運なので 多めに
 * （2026-10-01 ボットで 測ると：1つ なら 踏むのは 2割ほど・1〜2個で 安価が 来るのは 2.5割ほどの 階）。
 */
export const ANKA_TRAPS: [number, number] = [1, 2];
/** こなす までの レス数。 */
export const ANKA_DUE = 100;
/** 守らなかったときに 伸びる レス。 */
export const ANKA_PENALTY = 100;
/** 守らなかったときに 湧く 荒らしの 数（起きている）。 */
export const ANKA_TROLLS = 3;
/** 神安価で スレ民が 置いていく 道具の 数（正体つき）。 */
export const ANKA_GIFTS = 2;

const ANKA_TEXT: Record<AnkaKind, (need: number) => string> = {
	herb: () => "草を　1つ　飲む",
	scroll: () => "スレを　1つ　読む",
	throw: () => "何か　投げる",
	// 食べられるのは パンだけ（草は「飲む」なので 数えない）
	eat: () => "パンを　1つ　食う",
	kill: (n) => `敵を　${n}体　たおす`,
	// 眠れば 何でも いい（寝落ち草・罠・眠りの 呪文。Run.sleepPlayer で 数える）
	sleep: () => "寝る",
	// 敵の 攻撃が 当たった 回数（なぐる・矢・息。はずれや 罠は 数えない。core/monster.ts）
	hit: (n) => `攻撃を　${n}回　受ける`,
	// 杖を 振った（のこりが 0 で 何も 起きなくても 数える。core/effects.ts）
	staff: () => "杖を　1回　ふる",
	// 足元に 置いた（投げる・入れかえるは 数えない。Run.doDrop）
	drop: () => "道具を　1つ　置く",
	// 武器・板・指輪を べつの 物に かえた（外すだけ・矢は 数えない。Run.doEquip）
	equip: () => "装備を　かえる",
	// 罠を 踏んだ（動かなくても 数える。罠よけの指輪なら 踏まない。core/traps.ts）
	trap: () => "罠を　1つ　踏む",
	// レベルが 上がった（何段 上がっても 1回。Run.gainExp）
	level: () => "レベルを　1つ　上げる",
	// 「足踏み」の コマンド（眠りで 進む ターンは 数えない。Run.doCommand）
	rest: (n) => `その場で　${n}回　足踏み`,
};

/** お題ごとの こなす 回数。 */
const ANKA_NEED: Partial<Record<AnkaKind, number>> = {
	kill: 2,
	hit: 3,
	rest: 10,
};

/** 画面に 出す お題（「草を　1つ　飲む」）。 */
export const ankaText = (a: Anka): string => ANKA_TEXT[a.kind](a.need);

/** 階を 出るとき：出ている 安価を のこりの レス数つきで 持ち出す（無ければ null）。 */
export const carryAnka = (
	f: Floor | null | undefined,
): { a: Anka; left: number } | null =>
	f?.anka ? { a: f.anka, left: Math.max(1, f.anka.due - f.res) } : null;

/**
 * 階に 入ったとき：この階に 安価の罠を 置くかを 決める。
 * 前の 階から 持ちこした 安価が あれば それが つづき、この階には 罠を 置かない。
 */
export const scheduleAnka = (
	r: Run,
	carried: { a: Anka; left: number } | null = null,
): void => {
	const f = r.f;
	f.anka = null;
	if (carried) {
		// 同じ 物を 使う（画面は 物が かわったときだけ「安価が　来た」の レスを 出す）
		f.anka = carried.a;
		f.anka.due = f.res + carried.left;
		r.msg(
			`前スレの　安価は　まだ　生きている：${ankaText(f.anka)}（のこり　${carried.left}レス）`,
			"warn",
		);
		return;
	}
	// ボスの 待つ 階にも 来ない（湧かないので「敵を　2体　たおす」が こなせなく なる。持ちこした 安価は 上で つづく）
	if (!ankaTrapOk(r)) return;
	// パン板の 2階は 着いた ときに かならず 来る（はじめての 冒険で 安価を 1度は 味わう。罠は 置かない）
	if (ankaOnArrival(r)) return;
	const n = r.rng.range(ANKA_TRAPS[0], ANKA_TRAPS[1]);
	for (let i = 0; i < n; i++) {
		const at = r.rng.pick(freeRoomTiles(r, f, null));
		if (at) f.traps.push({ x: at.x, y: at.y, kind: "anka", found: false });
	}
};

/** 持ち物で いま できる お題。 */
const doable = (r: Run): AnkaKind[] => {
	const has = (cat: string) =>
		r.p.items.some(
			(it) => defOf(it.kind).cat === cat && !itemHidden(r.s, it.kind),
		);
	const out: AnkaKind[] = ["kill", "kill"];
	if (has("herb")) out.push("herb", "herb");
	if (has("scroll")) out.push("scroll", "scroll");
	if (has("food")) out.push("eat");
	if (r.p.items.some((it) => defOf(it.kind).cat !== "goal")) out.push("throw");
	// 寝る：自分で 寝られる とき だけ（正体の わかった 寝落ち草を 持っていて、起きる指輪を はめていない）。
	// 罠や 呪文でも 数えるが、それだけでは 運まかせなので 出さない
	if (
		!r.hasRing("r_awake") &&
		isKnownKind(r.s, "h_sleep") &&
		r.p.items.some((it) => it.kind === "h_sleep")
	)
		out.push("sleep");
	// 攻撃を 受ける：なぐってくる 敵が 階に いるとき（置物だけ なら 出さない）
	if (r.f.monsters.some((m) => m.hp > 0 && !m.status.dormant)) out.push("hit");
	// 杖：持っていれば（正体が わからなくても 振れる）
	if (has("staff")) out.push("staff");
	// 置く：手放せる 物が あれば（大事な 物・のろわれて 外せない 装備は 置けない）
	if (
		r.p.items.some(
			(it) => !isKeyItem(it.kind) && !(r.isEquipped(it) && it.cursed),
		)
	)
		out.push("drop");
	// 装備を かえる：はめていない 武器・板・指輪が あって、その 枠の 今の 物が のろわれていない とき
	const slotOf = { weapon: r.weapon(), shield: r.shield(), ring: r.ring() };
	if (
		r.p.items.some((it) => {
			const cat = defOf(it.kind).cat;
			if (cat !== "weapon" && cat !== "shield" && cat !== "ring") return false;
			return !r.isEquipped(it) && !slotOf[cat]?.cursed;
		})
	)
		out.push("equip");
	// 罠を 踏む：見つかっている 罠が 階に あるとき（罠よけの指輪を はめていたら 踏めない。
	// 安価の罠は 安価が 出ている うちは 動かないので 数えない）
	if (
		!r.hasRing("r_trap") &&
		r.f.traps.some((t) => t.found && t.kind !== "anka")
	)
		out.push("trap");
	// レベル：つぎまで 半分を 切っているとき（深い 階で 間に合わない お題に しない）
	const p = r.p;
	if (
		p.lv < MAX_LV &&
		EXP_AT[p.lv] - p.exp <= (EXP_AT[p.lv] - EXP_AT[p.lv - 1]) / 2
	)
		out.push("level");
	// 足踏みは いつでも できる
	out.push("rest");
	return out;
};

/** 安価の罠を 置ける 階か（帰り道・1階・ボスの 待つ 階には 置かない）。 */
export const ankaTrapOk = (r: Run): boolean =>
	!r.s.returning && r.s.depth >= 2 && !r.boss;

/** 階に 着いた とたんに 安価が 来る 階か（パン板の 2階。入門の 板で 安価を 1度は 見せる）。 */
export const ankaOnArrival = (r: Run): boolean =>
	r.dungeon.id === "shallow" && r.s.depth === 2 && ankaTrapOk(r);

/** 釣りスレで ふえる 罠が 安価の罠に なる 確率（釣りスレの いい 面）。 */
export const ANKA_SNARE_CHANCE = 1 / 10;

/** 安価の罠を 踏んだ：お題を 出す（もう 出ていれば 何も しない）。 */
export const startAnka = (r: Run): boolean => {
	const f = r.f;
	if (f.anka) return false;
	const kind = r.rng.pick(doable(r));
	const a: Anka = {
		kind,
		need: ANKA_NEED[kind] ?? 1,
		done: 0,
		due: f.res + ANKA_DUE,
	};
	f.anka = a;
	r.se("encounter");
	r.emit({ t: "anka" });
	r.msg(`安価が　来た：${ankaText(a)}`, "warn");
	r.msg(`（${ANKA_DUE}レス　以内に。安価は　絶対）`);
	return true;
};

/** ターンの 終わり（レスが 伸びたあと）：安価の 期限が 切れる。 */
export const tickAnka = (r: Run): void => {
	const f = r.f;
	const a = f.anka;
	if (!a || f.res < a.due) return;
	f.anka = null;
	r.se("encounter");
	r.emit({ t: "anka" });
	r.msg("安価を　守らなかった……　スレが　荒れた！", "warn");
	r.addRes(ANKA_PENALTY);
	// 眠っていた 敵も みんな 起きる（置物と、待っている ボスの 深い 眠りは そのまま）
	let woke = 0;
	for (const m of f.monsters)
		if (m.hp > 0 && m.status.sleep > 0 && !m.status.dormant) {
			wakeMonster(r, m);
			if (m.status.sleep === 0) woke++;
		}
	if (woke) r.msg("スレが　荒れて、みんな　目を　さました", "warn");
	// 荒らし（ふつうは 見えない 所から。どこも 見える 部屋なら 見える 所に）。
	// ボスが 生きている 階には 湧かない（時間の 湧きと 同じ。ボスとの 戦いに しぼる）
	let trolls = 0;
	for (let i = 0; i < (r.boss ? 0 : ANKA_TROLLS); i++) {
		const at = randomFloorPos(r, true) ?? randomFloorPos(r, false);
		if (at && spawnMonster(r, null, at, { awake: true })) trolls++;
	}
	if (trolls) r.msg(`荒らしが　${trolls}体　湧いてきた`, "warn");
};

/** お題に あたる ことを した（草を 飲んだ・敵を たおした など）。 */
export const ankaHit = (r: Run, kind: AnkaKind): void => {
	const a = r.f.anka;
	if (!a || a.kind !== kind || r.s.end) return;
	a.done++;
	if (a.done < a.need) return;
	r.f.anka = null;
	r.se("jingle");
	r.emit({ t: "anka" });
	r.msg("神安価！　スレ民が　いろいろ　置いていった", "good");
	// 道具（正体つき。見分ける 手間も ごほうび）
	for (const kind of rollKinds(r.rng, itemTableOf(r.s), ANKA_GIFTS)) {
		const it = r.newItem(kind);
		identifyKind(r.s, kind);
		it.known = true;
		r.placeItem(it, { x: r.p.x, y: r.p.y });
	}
};

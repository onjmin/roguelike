// 安価（前の レスで 取られた「>>今の レス番　が　草を　1つ　飲む」。2ch の 安価の 形）。階（スレ）の 途中で ときどき 来る、スレ民からの お題。
//
// - 2階から、階に 入ったとき ANKA_CHANCE で「来る レス数」を 決めておき、そこまで 伸びたら 来る。
// - お題は その時の 持ち物で できる ものから 選ぶ（草が なければ「草を　1つ　飲む」は 来ない）。
// - ANKA_DUE レス 以内に こなせば 神安価：スレ民が この板の 道具を ANKA_GIFTS 個（正体つき）足元に 置く。
// - 守らなければ スレが 荒れる：レスが ANKA_PENALTY 伸び、階の 敵が みんな 目を さまし、荒らしが ANKA_TROLLS 体 湧く
//   （ボスが 生きている 階には 湧かない）。
// - 帰り道には 来ない（帰り道は 補給なし）。ボスの 待つ 階にも 来ない（湧かないので 敵を たおす お題が こなせない）。
// - 出ている 安価は 階を かわっても 消えない（次スレに 持ちこし。のこりの レス数も そのまま）。

import { randomFloorPos, spawnMonster } from "./floor";
import { defOf, identifyKind, itemHidden, itemTableOf } from "./item";
import { rollKinds } from "./itemTable";
import { wakeMonster } from "./monster";
import type { Run } from "./run";
import type { Anka, AnkaKind, Floor } from "./types";

/** 階に 入ったとき 安価が 来る 確率。 */
export const ANKA_CHANCE = 2 / 5;
/** 来る レス数（階に 入ってから）。 */
export const ANKA_AT: [number, number] = [20, 220];
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
	eat: () => "何か　食う",
	kill: (n) => `敵を　${n}体　たおす`,
};

/** 画面に 出す お題（「草を　1つ　飲む」）。 */
export const ankaText = (a: Anka): string => ANKA_TEXT[a.kind](a.need);

/** 階を 出るとき：出ている 安価を のこりの レス数つきで 持ち出す（無ければ null）。 */
export const carryAnka = (
	f: Floor | null | undefined,
): { a: Anka; left: number } | null =>
	f?.anka ? { a: f.anka, left: Math.max(1, f.anka.due - f.res) } : null;

/**
 * 階に 入ったとき：この階に 安価が 来るか（来るなら 何レス目か）を 決める。
 * 前の 階から 持ちこした 安価が あれば それが つづき、この階には 新しく 来ない。
 */
export const scheduleAnka = (
	r: Run,
	carried: { a: Anka; left: number } | null = null,
): void => {
	const f = r.f;
	f.anka = null;
	f.ankaAt = -1;
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
	if (r.s.returning || r.s.depth < 2 || r.boss) return;
	if (!r.rng.chance(ANKA_CHANCE)) return;
	f.ankaAt = r.rng.range(ANKA_AT[0], ANKA_AT[1]);
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
	return out;
};

/** ターンの 終わり（レスが 伸びたあと）：安価が 来る・期限が 切れる。 */
export const tickAnka = (r: Run): void => {
	const f = r.f;
	if ((f.ankaAt ?? -1) >= 0 && f.res >= (f.ankaAt ?? 0) && !f.anka) {
		f.ankaAt = -1;
		const kind = r.rng.pick(doable(r));
		const a: Anka = {
			kind,
			need: kind === "kill" ? 2 : 1,
			done: 0,
			due: f.res + ANKA_DUE,
		};
		f.anka = a;
		r.se("encounter");
		r.emit({ t: "anka" });
		r.msg(`安価が　来た：${ankaText(a)}`, "warn");
		r.msg(`（${ANKA_DUE}レス　以内に。安価は　絶対）`);
		return;
	}
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

// 見せ場の 階（2026-10-21 作者「かっこいい 見せ場」「洋画みたいな 展開」）。題材は くだらない まま、遊びを 本気に する。
// 洋画は 型だけ 借りる（作品名・台詞は 使わない。STORY.md §0「映画の 演出」）。
// - siege（籠城・殲滅）：荒らしの 大群が 3波で 湧く。3波目には 町の 仲間が 加勢する。守りきると 全回復と 経験値。
//   電池板の 鉄塔（上りの 板）で、ひとりで 占拠された 塔を 上る 型。
// - escape（鯖落ちからの 脱出）：階に 着いた ときから レスが 800（出口の 階段は はじめから 見える）。止まると レスが 加速する（止まれない 乗り物の 型）。
//   1000 で dat落ち（上りの 板では 1つ 下へ 落ちて、のぼったぶんが パー）。階段まで 着けば 脱出。
// - stealth（潜入）：品の まわりで 見張りが 眠る。2マス 以内に 近づくか 起こすと 見つかって 増援。見つからずに 品を
//   拾えば 経験値。着いた とき 町の 仲間が 作戦を 言う（ロゼの 偵察で 地図が わかる）。仲間を 集めて 大仕事の 型。
// 乱数は 見せ場の 階でだけ 引く（ほかの 階・ほかの 板の 乱数の 順は かわらない）。帰り道には 起きない。

import { revealFloor } from "./effects";
import { spawnMonster } from "./floor";
import type { Pos } from "./geom";
import type { Run } from "./run";
import { DEEP, type DungeonId, type Floor, type Monster } from "./types";

export type SetPieceKind = "siege" | "escape" | "stealth";

/** 板ごとの 見せ場の 階（帰り道・名所・ボスの 階には 置かない）。 */
export const SETPIECES: Partial<
	Record<DungeonId, readonly { depth: number; kind: SetPieceKind }[]>
> = {
	// 最終話の 手前：鯖落ち寸前の 階を 駆け上がり、占拠された 鉄塔の 上で 荒らしを 迎え撃つ（16階は やきう）
	deep: [
		{ depth: 11, kind: "escape" },
		{ depth: 15, kind: "siege" },
	],
	// 植民地戦争の 最前線：管理部の 壺を 盗み出す（底の 10階）
	onkimu: [{ depth: 10, kind: "stealth" }],
};

/** 階に 残す 見せ場の ようす（Floor.setpiece）。 */
export type FloorSetPiece = {
	kind: SetPieceKind;
	/** 籠城：いまの 波（0 は まだ）と 次の 波の ターン・いまの 波の 敵。 */
	wave: number;
	nextAt: number;
	foes: number[];
	/** 潜入：見張り（uid）と、見つかった か。 */
	guards: number[];
	alarm?: true;
	/** 脱出：前の ターンの キリコの マス。 */
	last?: Pos;
	/** おわった（守りきった・脱出した・盗み出した）。 */
	done?: true;
};

/** 籠城の 波の 数と、波ごとの 敵の 数（1波目から）。 */
export const SIEGE_WAVES = [2, 3, 4] as const;
/** 波と 波の あいだ（ターン）。 */
export const SIEGE_GAP = 4;
/** 脱出の 階に 着いた ときの レス。 */
export const ESCAPE_RES = 800;
/** 脱出の 階で 止まった ときに 足す レス（動けば 足さない）。 */
export const ESCAPE_STILL = 3;
/** 潜入の 見張りの 数と、見つかる 近さ（マス）。 */
export const GUARDS = 3;
export const GUARD_SIGHT = 2;
/** 見つかった ときの 増援の 数。 */
export const ALARM_FOES = 4;
/** 見張りの 敵（特定班＝公安）。 */
const GUARD_KIND = "eye";

const cheb = (a: Pos, b: Pos): number =>
	Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** この 階の 見せ場（帰り道・ない 板・もう 置いた 階は null。落ちて また 来ても 1度きり）。 */
export const setPieceAt = (r: Run, depth: number): SetPieceKind | null =>
	r.s.returning || r.s.pieces?.includes(depth)
		? null
		: (SETPIECES[r.s.dungeon]?.find((x) => x.depth === depth)?.kind ?? null);

/** キリコから lo〜hi マスの 空いた 床（見える 所を 先に）。 */
const ringTiles = (r: Run, lo: number, hi: number): Pos[] => {
	const l = r.f.layout;
	const p = r.p;
	const near: Pos[] = [];
	const far: Pos[] = [];
	for (let y = Math.max(0, p.y - hi); y <= Math.min(l.h - 1, p.y + hi); y++)
		for (let x = Math.max(0, p.x - hi); x <= Math.min(l.w - 1, p.x + hi); x++) {
			const d = cheb(p, { x, y });
			if (d < lo || !r.isFree(x, y)) continue;
			(r.playerSees({ x, y }) ? near : far).push({ x, y });
		}
	return near.length ? near : far;
};

/** n 体 湧かせる（キリコの まわり。起きて いる）。湧いた 敵の uid。 */
const spawnAround = (
	r: Run,
	n: number,
	kind: string | null = null,
): number[] => {
	const spots = ringTiles(r, 2, 6);
	const out: number[] = [];
	for (let i = 0; i < n && spots.length; i++) {
		const at = spots.splice(r.rng.int(spots.length), 1)[0];
		const m = spawnMonster(r, kind, at, { awake: true });
		if (m) {
			out.push(m.uid);
			r.emit({ t: "appear", id: m.uid, pos: { x: m.x, y: m.y } });
		}
	}
	return out;
};

/** 果たした（Floor の 見せ場を おえ、冒険に 残す）。 */
const won = (r: Run, sp: FloorSetPiece): void => {
	sp.done = true;
	r.s.piecesWon = [...(r.s.piecesWon ?? []), r.f.depth];
};

const alive = (f: Floor, uid: number): Monster | undefined =>
	f.monsters.find((m) => m.uid === uid && m.hp > 0);

/**
 * 階を 作った あとに 見せ場を 置く（core/floor.ts の buildFloor。r.s.floor が この 階の あいだに 呼ぶ）。
 * 脱出は レスを 800 から（出口が 見える）、潜入は 品の まわりに 見張りを 眠らせる。籠城は 着いて から 湧く。
 */
export const placeSetPiece = (r: Run, f: Floor, kind: SetPieceKind): void => {
	f.setpiece = { kind, wave: 0, nextAt: 2, foes: [], guards: [] };
	r.s.pieces = [...(r.s.pieces ?? []), f.depth];
	if (kind === "escape") {
		f.res = ESCAPE_RES;
		// 出口は はじめから 見える（さがす 階で なく、走る 階）
		const l = f.layout;
		for (let y = f.stairs.y - 1; y <= f.stairs.y + 1; y++)
			for (let x = f.stairs.x - 1; x <= f.stairs.x + 1; x++)
				if (x >= 0 && y >= 0 && x < l.w && y < l.h) f.seen[y * l.w + x] = 1;
		return;
	}
	if (kind !== "stealth") return;
	const goal = f.items.find((x) => x.item.kind === r.dungeon.goal);
	if (!goal) return;
	const l = f.layout;
	const spots: Pos[] = [];
	for (let y = Math.max(0, goal.y - 5); y <= Math.min(l.h - 1, goal.y + 5); y++)
		for (
			let x = Math.max(0, goal.x - 5);
			x <= Math.min(l.w - 1, goal.x + 5);
			x++
		) {
			const d = cheb(goal, { x, y });
			if (
				d > GUARD_SIGHT &&
				r.isFree(x, y) &&
				!(x === f.stairs.x && y === f.stairs.y)
			)
				spots.push({ x, y });
		}
	for (let i = 0; i < GUARDS && spots.length; i++) {
		const at = spots.splice(r.rng.int(spots.length), 1)[0];
		const m = spawnMonster(r, GUARD_KIND, at, { sleep: DEEP, single: true });
		if (m) f.setpiece.guards.push(m.uid);
		// 見張りどうしは 少し 離す（同じ 所に かたまると 品に 近づけない）
		for (let j = spots.length - 1; j >= 0; j--)
			if (cheb(spots[j], at) < 2) spots.splice(j, 1);
	}
};

/** 階に 着いた ときの 掛け合い（Run.enterFloor の あと）。 */
export const arriveSetPiece = (r: Run): void => {
	const sp = r.f.setpiece;
	if (!sp || sp.done) return;
	if (sp.kind === "escape") {
		r.emit({ t: "cine", fx: "slowmo", ms: 900 });
		r.emitTalk("電池ニキ", [
			"この階、鯖ごと落ちかけとる。\nどうせ、もう800や",
			"止まったら、レスが加速する。\n……走れ。上へ",
		]);
		r.msg("止まると、レスが加速する！", "warn");
		return;
	}
	if (sp.kind === "siege") {
		r.emit({
			t: "cine",
			fx: "trailer",
			caption: "鉄塔は、\n荒らしに占拠されていた",
			ms: 1400,
		});
		r.msg("荒らしの大群が来る！スレを守りきれ！", "warn");
		return;
	}
	// 潜入：作戦（ロゼの 偵察で 地図、ゼロ 3機が 見張りを 数える）
	r.emitTalk("ロゼ", ["作戦アル。見取り図は、壁の中から\n見ておいたアル"]);
	revealFloor(r);
	r.emitTalk("ゼロ", [
		`見張り、${sp.guards.length}人です！\n2マスより近づくと、見つかります`,
	]);
	r.msg("見張りに見つからずに、壺を盗み出せ！", "warn");
};

/** 毎ターン（敵の 番の あと。Run.endTurn）。 */
export const tickSetPiece = (r: Run): void => {
	const f = r.f;
	const sp = f.setpiece;
	if (!sp || sp.done || r.s.end) return;
	if (sp.kind === "escape") {
		// 止まると 加速（動いた ターンは 足さない）
		const p = r.p;
		if (sp.last && sp.last.x === p.x && sp.last.y === p.y)
			r.addRes(ESCAPE_STILL);
		sp.last = { x: p.x, y: p.y };
		return;
	}
	if (sp.kind === "siege") {
		sp.foes = sp.foes.filter((uid) => alive(f, uid));
		if (sp.foes.length || f.turns < sp.nextAt) return;
		if (sp.wave >= SIEGE_WAVES.length) {
			won(r, sp);
			r.emit({
				t: "cine",
				fx: "freeze",
				caption: "スレ、守りきった",
				ms: 1200,
			});
			r.msg("荒らしの大群を、ぜんぶ追いかえした！", "good");
			r.healPlayer(r.p.maxHp);
			r.gainExp(60 * SIEGE_WAVES.length);
			return;
		}
		const n = SIEGE_WAVES[sp.wave];
		sp.wave++;
		r.msg(`荒らし、第${sp.wave}波！`, "warn");
		sp.foes = spawnAround(r, n);
		sp.nextAt = f.turns + SIEGE_GAP;
		if (sp.wave === SIEGE_WAVES.length) siegeHelp(r, sp);
		return;
	}
	// 潜入
	if (sp.alarm) return;
	const goalHeld = r.p.items.some((it) => it.kind === r.dungeon.goal);
	if (goalHeld) {
		won(r, sp);
		r.emit({
			t: "cine",
			fx: "freeze",
			caption: "ミッション、コンプリート",
			ms: 1200,
		});
		r.msg("だれにも見つからずに、盗み出した！", "good");
		r.gainExp(200);
		return;
	}
	for (const uid of sp.guards) {
		const g = alive(f, uid);
		if (!g) continue;
		if (g.status.sleep === 0 || cheb(g, r.p) <= GUARD_SIGHT) {
			raiseAlarm(r, sp);
			return;
		}
	}
};

/** 見つかった：見張りが 起きて、増援が 湧く。 */
const raiseAlarm = (r: Run, sp: FloorSetPiece): void => {
	sp.alarm = true;
	const f = r.f;
	for (const uid of sp.guards) {
		const g = alive(f, uid);
		if (g && g.status.sleep > 0) {
			g.status.sleep = 0;
			g.nextAt = Math.max(g.nextAt, r.p.nextAt + 1);
		}
	}
	r.emit({ t: "cine", fx: "freeze", caption: "見つかった", ms: 900 });
	r.msg("見つかった！管理部の増援が来る！", "warn");
	spawnAround(r, ALARM_FOES);
};

/** 籠城の 3波目：町の 仲間の 加勢（ロゼは 壁を 抜けて 背後から、ゼロは 3機で 囲んで 数える）。 */
const siegeHelp = (r: Run, sp: FloorSetPiece): void => {
	const f = r.f;
	const foes = sp.foes
		.map((uid) => alive(f, uid))
		.filter((m): m is Monster => !!m);
	const [a, b] = foes;
	r.emit({ t: "cine", fx: "slowmo", ms: 1000 });
	if (a) {
		r.emitTalk("ロゼ", ["加勢アル！\n壁の中から、背後をとるアル"]);
		const cut = Math.floor(a.hp / 2);
		a.hp -= cut;
		r.emit({
			t: "hurt",
			id: a.uid,
			pos: { x: a.x, y: a.y },
			amount: cut,
			hp: a.hp,
		});
		r.msg("ロゼが壁を抜けて、背後から説教した！");
	}
	if (b) {
		r.emitTalk("ゼロ", ["3機で囲みます！\n数えられたら、動けません"]);
		b.status.sleep = 6;
		r.msg("ゼロの3機が囲んで、数えはじめた。荒らしは固まった");
	}
};

/** 階段で 階を 出る（Run.useStairs）。脱出の 階なら 脱出できた。 */
export const leaveSetPiece = (r: Run): void => {
	const sp = r.f.setpiece;
	if (!sp || sp.done || sp.kind !== "escape") return;
	won(r, sp);
	r.emit({ t: "cine", fx: "blast", ms: 1200 });
	r.msg(`レス${r.f.res}。鯖落ち寸前で、脱出した！`, "good");
	r.gainExp(120);
};

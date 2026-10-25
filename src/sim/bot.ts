// 自動プレイのボット（調整と、落ちないかの検査用。解音ゼロの オートでも 使う：ui/dungeon/play.ts の autoTick）。
//
// ふつうのプレイヤーがやりそうなことを、単純な優先順で行う：
// 回復 → 食事 → となりの敵をなぐる → 装備の更新 → 識別 → 見えている道具を拾う → 探索 → 階段。
// 目的が boss の いちばん底では 階を 出ようとせず、道具を 拾いつつ 探索し、ボスを 見つけて 戦う
// （ボスの 居場所は のぞいて よい。ボスから 逃げない）。

import { HUNGER_UNIT } from "../core/balance";
import { needsTarget } from "../core/effects";
import { roomsSeenFrom } from "../core/fov";
import {
	DIRS8,
	type Dir8,
	dirOf,
	dist,
	opposite,
	type Pos,
	step,
} from "../core/geom";
import { defOf, isKeyItem, isKnownKind, itemHidden } from "../core/item";
import { isFloor, roomAt, roomExits } from "../core/mapgen";
import { mdef } from "../core/monster";
import type { Run } from "../core/run";
import { type Command, type Item, PLAYER_ID } from "../core/types";

const BAD_HERBS = new Set([
	"h_poison",
	"h_blind",
	"h_reel",
	"h_daze",
	"h_sleep",
]);

export type BotOpts = {
	/** この階に長くいすぎたら階段へ（ターン）。 */
	floorTurnLimit: number;
	/** 階の道具を見つけきったら降りる。 */
	leaveWhenNoItems: boolean;
	/** 危ないときに 帰還スレで 地上へ もどる（倒れないモードでは 深い階まで行きたいので 使わない）。 */
	escape: boolean;
	/**
	 * 階段を 見つけたら（見えている 道具を 拾い おえたら）その 階を 出る。解音ゼロの オート用
	 * （2026-10-14 作者：「階段 見つけても まだ ウロウロ」。sim は 階を 見つくして 道具と 経験値を 集める ままに する）。
	 */
	stairsWhenSeen?: boolean;
	/**
	 * 2体 以上に 向かってこられたら、まわりの 開けた（なぐられる 向きの 多い）所から、1〜2方向 しか
	 * なぐられない 所（通路・入口）へ 下がって、そこで 待ちうける。解音ゼロの オート用
	 * （2026-10-15 作者：「複数の 敵と 戦うとき、通路に 逃げるとか しないのですか」）。
	 * 下の 部屋の 入口へ 下がる 手は sim の ボットにも ある。こちらは 部屋の 外・2体に 囲まれた 後でも 下がり、
	 * 下がった 所で 敵が 来るのを 待つ（見えなく なって すぐ 部屋へ もどる のを くり返さない）。
	 */
	chokepoint?: boolean;
};

export const DEFAULT_BOT: BotOpts = {
	floorTurnLimit: 700,
	leaveWhenNoItems: true,
	escape: true,
};

/**
 * 解音ゼロの オートの ボット（ui/dungeon/play.ts。pnpm sim -- --auto でも 使う）：帰還スレで 地上へ
 * もどらない（冒険を 終わらせるのは 自分で）。階段を 見つけたら 見えている 道具を 拾って 降りる
 * （階を 見つくすまで 歩きまわらない）。2体 以上には 通路・入口で 1体ずつ。
 */
export const AUTO_BOT: BotOpts = {
	...DEFAULT_BOT,
	escape: false,
	stairsWhenSeen: true,
	chokepoint: true,
};

/** 知っているマスの上の道のり（罠を避ける）。to へ向かう最初の一歩。 */
const pathStep = (r: Run, to: Pos, avoidMonsters: boolean): Dir8 | null =>
	// 見つけた罠は よけて通る。よけられない（通路をふさいでいる）ときだけ 踏んで通る。
	// 寝ている敵が通路をふさいでいたら、なぐって通る（botCommand が なぐるに変える）
	pathStepVia(r, to, avoidMonsters, true) ??
	pathStepVia(r, to, avoidMonsters, false) ??
	(avoidMonsters ? pathStepVia(r, to, false, false) : null);

const pathStepVia = (
	r: Run,
	to: Pos,
	avoidMonsters: boolean,
	avoidTraps: boolean,
): Dir8 | null => {
	const f = r.f;
	const l = f.layout;
	const w = l.w;
	const start = r.p.y * w + r.p.x;
	const goal = to.y * w + to.x;
	const fusedBombs = f.monsters.filter((m) => m.fuse && r.monsterVisible(m));
	const prev = new Int32Array(l.w * l.h).fill(-2);
	prev[start] = -1;
	const q = [start];
	const traps = new Set(
		f.traps.filter((t) => t.found).map((t) => t.y * w + t.x),
	);
	for (let h = 0; h < q.length; h++) {
		const i = q[h];
		if (i === goal) break;
		const x = i % w;
		const y = (i - x) / w;
		for (const d of DIRS8) {
			const n = step({ x, y }, d);
			if (!isFloor(l, n.x, n.y)) continue;
			const ni = n.y * w + n.x;
			if (prev[ni] !== -2) continue;
			if (!f.seen[ni] && ni !== goal) continue;
			if (!r.cornerOk({ x, y }, d)) continue;
			if (fusedBombs.some((m) => dist(n, m) <= 2)) continue;
			if (avoidTraps && traps.has(ni) && ni !== goal) continue;
			if (avoidMonsters && r.monsterAt(n.x, n.y) && ni !== goal) continue;
			prev[ni] = i;
			q.push(ni);
		}
	}
	if (prev[goal] === -2) return null;
	let cur = goal;
	while (prev[cur] !== start && prev[cur] >= 0) cur = prev[cur];
	const x = cur % w;
	const y = (cur - x) / w;
	return dirOf(x - r.p.x, y - r.p.y);
};

/** from から to へ 8方向の直線上かつ障害物（壁や他キャラ）がないか。射線が通っていれば方向を返す。 */
const clearLine = (r: Run, from: Pos, to: Pos, maxRange = 10): Dir8 | null => {
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) return null;
	const d = dirOf(dx, dy) as Dir8 | null;
	if (d === null) return null;
	const steps = Math.max(Math.abs(dx), Math.abs(dy));
	if (steps === 0 || steps > maxRange) return null;
	let cur = { x: from.x, y: from.y };
	for (let i = 1; i < steps; i++) {
		if (!r.cornerOk(cur, d)) return null;
		cur = step(cur, d);
		if (!isFloor(r.f.layout, cur.x, cur.y)) return null;
		if (r.monsterAt(cur.x, cur.y) || r.isGuestAt(cur.x, cur.y)) return null;
	}
	if (!r.cornerOk(cur, d)) return null;
	return d;
};

/** 未踏の境目（見たことのある床で、となりに見ていないマスがある所）のうち近いもの。 */
const frontier = (r: Run): Pos | null => {
	// 歩いて近い順（まっすぐの距離で選ぶと、左右に同じくらい遠い境目があるとき 行ったり来たりする）
	const f = r.f;
	const l = f.layout;
	const w = l.w;
	const isOpen = (x: number, y: number): boolean => {
		for (const d of DIRS8) {
			const n = step({ x, y }, d);
			if (n.x < 0 || n.y < 0 || n.x >= l.w || n.y >= l.h) continue;
			if (!f.seen[n.y * w + n.x] && isFloor(l, n.x, n.y)) return true;
		}
		return false;
	};
	const start = r.p.y * w + r.p.x;
	const seenAt = new Uint8Array(l.w * l.h);
	seenAt[start] = 1;
	const q = [start];
	for (let h = 0; h < q.length; h++) {
		const i = q[h];
		const x = i % w;
		const y = (i - x) / w;
		if (i !== start && isOpen(x, y)) return { x, y };
		for (const d of DIRS8) {
			const n = step({ x, y }, d);
			if (!isFloor(l, n.x, n.y)) continue;
			const ni = n.y * w + n.x;
			if (seenAt[ni] || !f.seen[ni] || !r.cornerOk({ x, y }, d)) continue;
			seenAt[ni] = 1;
			q.push(ni);
		}
	}
	return null;
};

const itemScore = (it: Item): number => {
	const d = defOf(it.kind);
	if (d.cat === "weapon") return (d.atk ?? 0) + (it.known ? it.plus : 0);
	if (d.cat === "shield") return (d.def ?? 0) + (it.known ? it.plus : 0);
	return 0;
};

const redundantGear = (
	r: Run,
	item: Item,
	slot: "weapon" | "shield",
): boolean => {
	const equipped = slot === "weapon" ? r.weapon() : r.shield();
	return (
		equipped !== null &&
		item.uid !== equipped.uid &&
		defOf(item.kind).cat === slot &&
		itemScore(item) <= itemScore(equipped)
	);
};

const forgottenItems = new WeakMap<object, Set<number>>();

/** ボットの次のコマンド。 */
export const botCommand = (r: Run, opts: BotOpts = DEFAULT_BOT): Command => {
	const cmd = decide(r, opts);
	if (cmd.c === "drop" || cmd.c === "throw") {
		const item = r.findItem(cmd.item);
		if (item && !(r.isEquipped(item) && item.cursed)) {
			let forgotten = forgottenItems.get(r.f);
			if (!forgotten) {
				forgotten = new Set();
				forgottenItems.set(r.f, forgotten);
			}
			const splitArrow =
				cmd.c === "throw" && defOf(item.kind).cat === "arrow" && item.count > 1;
			forgotten.add(splitArrow ? r.s.nextUid : item.uid);
		}
	}
	// 敵の方へ歩いても 向くだけ（見えない敵には ぶつかるだけ）なので、道をふさぐ敵は なぐる。
	// 見えない敵も なぐる（人なら「なにかに　ぶつかった」のあと A を押す。ボットは その1手を省く）
	if (cmd.c === "move") {
		const to = step(r.p, cmd.dir);
		const m = r.monsterAt(to.x, to.y);
		if (
			m &&
			!m.disguise &&
			!m.fuse &&
			!m.retreating &&
			r.cornerOk(r.p, cmd.dir)
		)
			return { c: "attack", dir: cmd.dir };
	}
	return cmd;
};

const decide = (r: Run, opts: BotOpts): Command => {
	const p = r.p;
	const f = r.f;
	const items = p.items;
	const visible = f.monsters.filter((m) => r.monsterVisible(m) && !m.disguise);
	const fusedBombs = visible.filter((m) => m.fuse);
	const awake = (m: (typeof visible)[number]) =>
		m.status.sleep === 0 && !m.status.dormant && m.status.paralyze === 0;
	let invisibleAttacker: {
		m: (typeof f.monsters)[number];
		dir: Dir8;
	} | null = null;
	if (r.ev.some((e) => e.t === "hurt" && e.id === PLAYER_ID)) {
		for (const e of r.ev) {
			if (e.t !== "attack") continue;
			const m = f.monsters.find((foe) => foe.uid === e.id);
			if (
				!m ||
				r.monsterVisible(m) ||
				!mdef(m).abilities.some((a) => a.k === "invisible")
			)
				continue;
			const dir = opposite(e.dir);
			const at = step(p, dir);
			if (r.monsterAt(at.x, at.y) === m) {
				invisibleAttacker = { m, dir };
				break;
			}
		}
	}
	const hunting = p.hp / p.maxHp > 0.7;
	const adjacent = visible.filter(
		(m) =>
			!m.fuse &&
			!m.retreating &&
			dist(m, p) === 1 &&
			(awake(m) ||
				(hunting &&
					m.status.sleep > 0 &&
					!["neochi", "tensai", "yuki"].includes(m.kind))) &&
			r.cornerOk(p, dirOf(m.x - p.x, m.y - p.y) as Dir8),
	);
	// 逃げる敵（ROM専・弱った自演くん）と 動かない敵（かまってちゃん）は向かってこないので数えない
	// （数えると、通路へ 下がって 待つのを いつまでも くり返す）
	const threats = visible.filter(
		(m) =>
			awake(m) &&
			dist(m, p) <= 4 &&
			!m.retreating &&
			!m.fuse &&
			!mdef(m).abilities.some((a) => a.k === "shy" || a.k === "grab"),
	);
	const hpRate = p.hp / p.maxHp;
	if (fusedBombs.length) {
		const danger = (at: Pos) => ({
			bombs: fusedBombs.filter((m) => dist(m, at) <= 2).length,
			distance: fusedBombs.reduce((n, m) => n + dist(m, at), 0),
		});
		const here = danger(p);
		if (here.bombs > 0) {
			const traps = new Set(
				f.traps.filter((t) => t.found).map((t) => t.y * f.layout.w + t.x),
			);
			const retreatStep = DIRS8.map((dir) => step(p, dir))
				.map((at, index) => ({ at, dir: DIRS8[index], score: danger(at) }))
				.filter(
					({ at, dir, score }) =>
						r.canStepTerrain(p, dir) &&
						r.cornerOk(p, dir) &&
						!r.monsterAt(at.x, at.y) &&
						!traps.has(at.y * f.layout.w + at.x) &&
						(score.bombs < here.bombs ||
							(score.bombs === here.bombs && score.distance > here.distance)),
				)
				.sort(
					(a, b) =>
						a.score.bombs - b.score.bombs ||
						b.score.distance - a.score.distance,
				)[0];
			return retreatStep ? { c: "move", dir: retreatStep.dir } : { c: "wait" };
		}
	}
	const known = (it: Item) => isKnownKind(r.s, it.kind);
	// アク禁中・見えない スレは 読めない（ターンが 進まず、同じ 手を くり返して 止まって いた）
	const readable = (it: Item) =>
		p.status.blind === 0 && !itemHidden(r.s, it.kind);
	const faceAnd = (dir: Dir8, cmd: Command): Command =>
		p.dir !== dir ? { c: "turn", dir } : cmd;

	// 回復
	if (hpRate < 0.35) {
		const heal =
			items.find((i) => i.kind === "h_greater" && known(i)) ??
			items.find((i) => i.kind === "h_heal" && known(i));
		if (heal) return { c: "use", item: heal.uid };
		if (adjacent.length || invisibleAttacker) {
			// 逃げる手：跳び草・転送の杖・眠りの杖
			const dir =
				adjacent[0] !== undefined
					? (dirOf(adjacent[0].x - p.x, adjacent[0].y - p.y) as Dir8)
					: invisibleAttacker?.dir;
			if (dir === undefined) return { c: "wait" };
			const blink = items.find((i) => i.kind === "h_blink" && known(i));
			if (blink) return { c: "use", item: blink.uid };
			const staff = items.find(
				(i) =>
					["w_send", "w_sleep", "w_reel", "w_slow"].includes(i.kind) &&
					known(i) &&
					i.charges > 0,
			);
			if (staff) return faceAnd(dir, { c: "use", item: staff.uid });
			if (hpRate < 0.25) {
				// 正体のわかった帰還スレで 地上へ（帰り道では効かない）
				const esc = items.find(
					(i) => i.kind === "s_escape" && known(i) && readable(i),
				);
				if (esc && !r.s.returning && opts.escape)
					return { c: "use", item: esc.uid, target: 0 };
				const unk = items.find(
					(i) => defOf(i.kind).cat === "herb" && !known(i),
				);
				if (unk) return { c: "use", item: unk.uid };
				const scroll = items.find(
					(i) =>
						defOf(i.kind).cat === "scroll" &&
						!known(i) &&
						readable(i) &&
						!["s_appraise", "s_bread", "s_recharge"].includes(i.kind),
				);
				if (scroll) return { c: "use", item: scroll.uid };
			}
		}
	}
	if (invisibleAttacker) {
		if (opts.chokepoint && exposure(r, p) >= 3) {
			const c = chokeStep(r, [invisibleAttacker.m, ...threats], 3);
			if (c) {
				setHold(r, c.to);
				return { c: "move", dir: c.dir };
			}
		}
		return { c: "attack", dir: invisibleAttacker.dir };
	}
	// 遠くの敵に矢（ボール）を撃つ
	const arrow = items.find((i) => defOf(i.kind).cat === "arrow");
	if (arrow && !adjacent.length) {
		for (const m of [...threats, ...fusedBombs]) {
			if (dist(m, p) < 2) continue;
			if (m.fuse && dist(m, p) <= 2) continue;
			const dir = clearLine(r, p, m);
			if (dir !== null) {
				return faceAnd(dir, { c: "throw", item: arrow.uid, dir });
			}
		}
	}

	// 弱って逃げる敵（自演くん等）：ボール等で追撃・射線を通せる位置へ移動・追い詰めて倒す
	const retreatingFoes = visible.filter(
		(m) =>
			!m.fuse &&
			(m.retreating || (m.kind === "chimera" && m.hp <= m.maxHp * 0.5)),
	);
	if (retreatingFoes.length > 0 && hpRate >= 0.25) {
		const foe = retreatingFoes.sort((a, b) => dist(a, p) - dist(b, p))[0];
		const dToFoe = dirOf(foe.x - p.x, foe.y - p.y);
		// となりにいるなら直接攻撃してとどめを刺す
		if (
			dist(foe, p) === 1 &&
			dToFoe !== null &&
			r.cornerOk(p, dToFoe as Dir8)
		) {
			return { c: "attack", dir: dToFoe as Dir8 };
		}
		// ボール（矢）を持っている場合：射線が通っていれば投げる
		if (arrow) {
			const directDir = clearLine(r, p, foe);
			if (directDir !== null && dist(foe, p) >= 2) {
				return faceAnd(directDir, {
					c: "throw",
					item: arrow.uid,
					dir: directDir,
				});
			}
			// まだ射線が通っていない場合：1歩動けば射線が通る位置（追撃出来る位置）を探して移動する
			for (const d of DIRS8) {
				const n = step(p, d);
				if (
					r.canStepTerrain(p, d) &&
					r.cornerOk(p, d) &&
					!r.monsterAt(n.x, n.y) &&
					!r.isGuestAt(n.x, n.y) &&
					!f.traps.some((t) => t.found && t.x === n.x && t.y === n.y)
				) {
					const lineDir = clearLine(r, n, foe);
					if (lineDir !== null) {
						return { c: "move", dir: d };
					}
				}
			}
		}
		// ボールがないか射線が遠い場合：追い詰めて倒すために接近する
		const chase = pathStep(r, foe, false);
		if (chase !== null) {
			return { c: "move", dir: chase };
		}
	}

	// 価値の低いアイテム（チギュリパン等：食べるとちから・HPが下がる）を優先的に捨てる
	const canDropNow =
		!r.itemAt(p.x, p.y) &&
		!r.onStairs() &&
		!f.wards.includes(p.y * f.layout.w + p.x);
	if (canDropNow && threats.length === 0) {
		const moldy = items.find((i) => i.kind === "f_moldy");
		if (moldy) return { c: "drop", item: moldy.uid };
		const badHerb = items.find((i) => BAD_HERBS.has(i.kind) && known(i));
		if (badHerb && (items.length >= 8 || hpRate > 0.5)) {
			return { c: "drop", item: badHerb.uid };
		}
	}

	// 食事（チギュリパンは極度の飢餓時かつ他がない場合のみ）
	if (p.hunger < 12 * HUNGER_UNIT) {
		const food =
			items.find((i) => i.kind === "f_bread") ??
			items.find((i) => i.kind === "f_large") ??
			(p.hunger === 0 && p.hp > 15
				? items.find((i) => i.kind === "f_moldy")
				: undefined);
		if (food) return { c: "use", item: food.uid };
	}
	// オート：2体 以上に 向かってこられたら、なぐられる 向きの 多い 所から 通路・入口へ 下がる。
	// 2体に 囲まれて いても、1歩で 入口へ 入れる なら 入る（入口へは 部屋の 中から まっすぐ 1体 しか なぐれない）
	if (opts.chokepoint && threats.length >= 2) {
		// 階を 出る ところで 階段の 上なら 降りて しまう
		if (
			opts.stairsWhenSeen &&
			r.onStairs() &&
			!r.boss &&
			(r.s.returning || r.s.depth < r.dungeon.floors)
		)
			return { c: "stairs" };
		if (exposure(r, p) >= 3 && adjacent.length <= 2) {
			const c = chokeStep(r, threats, [3, 2, 1][adjacent.length]);
			if (c) {
				setHold(r, c.to);
				return { c: "move", dir: c.dir };
			}
		}
	}
	// 部屋で2体以上に向かってこられたら、通路（入口）へ下がって1体ずつ相手にする
	const inRoom = roomAt(f.layout, p.x, p.y) >= 0;
	if (inRoom && threats.length >= 2 && adjacent.length <= 1) {
		const exits = roomExits(
			f.layout,
			f.layout.rooms[roomAt(f.layout, p.x, p.y)],
		)
			.filter((e) => !r.monsterAt(e.x, e.y))
			.sort((a, b) => dist(a, p) - dist(b, p));
		const exit = exits.find((e) =>
			threats.every((m) => dist(m, e) >= dist(p, e)),
		);
		if (exit && dist(exit, p) <= 4) {
			const d = pathStep(r, exit, true);
			if (d !== null) return { c: "move", dir: d };
		}
	}
	// 入口に立っていると 部屋の中から撃たれる・呪文をかけられる。もう1歩 通路へ下がって、見えない所で1体ずつ
	const onDoorway = !inRoom && roomsSeenFrom(f.layout, p.x, p.y).length > 0;
	if (onDoorway && threats.length >= 2 && adjacent.length <= 1) {
		for (const d of DIRS8) {
			const n = step(p, d);
			if (
				isFloor(f.layout, n.x, n.y) &&
				roomAt(f.layout, n.x, n.y) < 0 &&
				roomsSeenFrom(f.layout, n.x, n.y).length === 0 &&
				!r.monsterAt(n.x, n.y) &&
				r.cornerOk(p, d) &&
				!(
					opts.chokepoint &&
					f.traps.some((t) => t.found && t.x === n.x && t.y === n.y)
				)
			) {
				if (opts.chokepoint) setHold(r, n);
				return { c: "move", dir: d };
			}
		}
	}
	// となりの敵
	if (adjacent.length) {
		const m = adjacent.sort((a, b) => a.hp - b.hp)[0];
		const dir = dirOf(m.x - p.x, m.y - p.y) as Dir8;
		// 強そうな相手には 杖を振ってみる
		if (m.hp > p.hp && mdef(m).atk > 10) {
			const staff = items.find(
				(i) =>
					defOf(i.kind).cat === "staff" &&
					i.charges > 0 &&
					(!known(i) ||
						[
							"w_bolt",
							"w_sleep",
							"w_reel",
							"w_seal",
							"w_send",
							"w_slow",
						].includes(i.kind)),
			);
			if (staff) {
				if (p.dir !== dir) return { c: "turn", dir };
				return { c: "use", item: staff.uid };
			}
		}
		return { c: "attack", dir };
	}
	// オート：下がった 所で 敵が 来るのを 待つ（見えなく なっても すぐには 部屋へ もどらない。
	// もどると また 2体に 向かってこられて 下がる のを くり返す）
	if (opts.chokepoint) {
		const h = holds.get(f);
		if (h && (h.x !== p.x || h.y !== p.y)) holds.delete(f);
		else if (h) {
			const t = r.s.turn;
			if (threats.length) h.until = Math.max(h.until, t + HOLD_LINGER);
			if (t < h.until && t - h.since < HOLD_MAX) return { c: "wait" };
			holds.delete(f);
		}
	}
	// 安価：敵が いないうちに こなす（人も 安い お題なら 乗る）
	const anka = f.anka;
	if (anka && threats.length === 0) {
		const pick = (cat: string, ok: (i: Item) => boolean = () => true) =>
			items.find((i) => defOf(i.kind).cat === cat && !r.isEquipped(i) && ok(i));
		const cmd: Command | null =
			anka.kind === "herb"
				? (() => {
						const h = pick(
							"herb",
							(i) =>
								!known(i) ||
								(!BAD_HERBS.has(i.kind) &&
									!["h_heal", "h_greater"].includes(i.kind)),
						);
						return h ? { c: "use", item: h.uid } : null;
					})()
				: anka.kind === "scroll"
					? (() => {
							const s = pick(
								"scroll",
								(i) =>
									readable(i) &&
									(!known(i) || !["s_escape", "s_snare"].includes(i.kind)),
							);
							if (!s) return null;
							// 相手を 選ぶ スレは ほかの 持ち物を 1つ（帰還スレは 聞かれて やめる）
							const other = items.find((i) => i !== s);
							return needsTarget(s) && other
								? { c: "use", item: s.uid, target: other.uid }
								: { c: "use", item: s.uid };
						})()
					: anka.kind === "eat" && p.hunger < 60 * HUNGER_UNIT
						? (() => {
								const food = pick("food");
								return food ? { c: "use", item: food.uid } : null;
							})()
						: anka.kind === "throw"
							? (() => {
									// 矢は 投げても 安価に 数えない（core/effects.ts の throwItem は
									// 矢だけ ankaHit を 呼ばない）。物を 投げる お題には 矢 以外を 使う
									const t =
										pick("herb", (i) => known(i) && BAD_HERBS.has(i.kind)) ??
										pick("weapon", (i) => i.kind === "club") ??
										items.find(
											(i) =>
												!isKeyItem(i.kind) &&
												defOf(i.kind).cat !== "arrow" &&
												!r.isEquipped(i),
										) ??
										items.find(
											(i) =>
												!isKeyItem(i.kind) &&
												defOf(i.kind).cat !== "arrow" &&
												!(r.isEquipped(i) && i.cursed),
										);
									return t ? { c: "throw", item: t.uid, dir: p.dir } : null;
								})()
							: anka.kind === "sleep"
								? (() => {
										const h = pick(
											"herb",
											(i) => i.kind === "h_sleep" && known(i),
										);
										return h ? { c: "use", item: h.uid } : null;
									})()
								: anka.kind === "staff"
									? (() => {
											const w = pick("staff");
											return w ? { c: "use", item: w.uid } : null;
										})()
									: anka.kind === "drop" && !r.itemAt(p.x, p.y) && !r.onStairs()
										? (() => {
												// いちばん いらない 物（わかっている 悪い 草 → 矢 → 何でも）
												const d =
													pick(
														"herb",
														(i) => known(i) && BAD_HERBS.has(i.kind),
													) ??
													pick("arrow") ??
													items.find(
														(i) =>
															!r.isEquipped(i) && defOf(i.kind).cat !== "goal",
													);
												return d ? { c: "drop", item: d.uid } : null;
											})()
										: anka.kind === "rest"
											? { c: "wait" }
											: null;
		if (cmd) return cmd;
	}
	// 装備の更新
	for (const slot of ["weapon", "shield"] as const) {
		const cur = slot === "weapon" ? r.weapon() : r.shield();
		if (cur?.cursed) continue;
		const better = items
			.filter(
				(i) =>
					defOf(i.kind).cat === slot && i !== cur && !(i.known && i.cursed),
			)
			.sort((a, b) => itemScore(b) - itemScore(a))[0];
		if (better && (!cur || itemScore(better) > itemScore(cur)))
			return { c: "equip", item: better.uid };
	}
	const canDropGear =
		!r.itemAt(p.x, p.y) &&
		!r.onStairs() &&
		!f.wards.includes(p.y * f.layout.w + p.x);
	if (canDropGear) {
		for (const slot of ["weapon", "shield"] as const) {
			const extra = items.find((i) => redundantGear(r, i, slot));
			if (extra) return { c: "drop", item: extra.uid };
		}
	}
	if (!r.ring()) {
		const ring = items.find(
			(i) =>
				defOf(i.kind).cat === "ring" &&
				!(i.known && i.cursed) &&
				!["r_hunger", "r_clamor"].includes(i.kind),
		);
		if (ring && visible.length === 0) return { c: "equip", item: ring.uid };
	}
	// 敵が見えていないときに 識別・強化
	// HPに余裕があるとき（hpRate >= 0.65）：草や板（盾）等の未鑑定アイテムを出し惜しみせず使用・試着して識別する
	if (
		visible.length === 0 ||
		(hpRate >= 0.65 && threats.length === 0 && !adjacent.length)
	) {
		// 未鑑定の草を飲む（HPに余裕があるときに積極的に試す）
		if (hpRate >= 0.65) {
			const unkHerb = items.find(
				(i) => defOf(i.kind).cat === "herb" && !known(i),
			);
			if (unkHerb) return { c: "use", item: unkHerb.uid };
		}

		// 未鑑定の板（盾）を装備してみる（呪われていないか・補正値確認）
		const curShield = r.shield();
		if (!curShield?.cursed) {
			const unkShield = items.find(
				(i) => defOf(i.kind).cat === "shield" && !i.known,
			);
			if (unkShield) return { c: "equip", item: unkShield.uid };
		}

		const scroll = items.find(
			(i) => defOf(i.kind).cat === "scroll" && !known(i) && readable(i),
		);
		if (scroll) {
			const need = ["s_appraise", "s_bread", "s_recharge"].includes(
				scroll.kind,
			);
			if (need) {
				const target =
					scroll.kind === "s_recharge"
						? (items.find((i) => defOf(i.kind).cat === "staff") ??
							items.find((i) => i !== scroll && defOf(i.kind).cat === "scroll"))
						: scroll.kind === "s_bread"
							? (items.find((i) => i.kind === "f_moldy") ??
								items.find((i) => i.kind === "h_poison" && known(i)) ??
								items.find((i) => i !== scroll && !r.isEquipped(i)))
							: items.find((i) => i !== scroll && !known(i));
				if (target) return { c: "use", item: scroll.uid, target: target.uid };
			} else return { c: "use", item: scroll.uid };
		}

		// 未鑑定の武器を試着
		const curWeapon = r.weapon();
		if (!curWeapon?.cursed) {
			const unkWeapon = items.find(
				(i) => defOf(i.kind).cat === "weapon" && !i.known,
			);
			if (unkWeapon) return { c: "equip", item: unkWeapon.uid };
		}

		for (const k of ["s_whet", "s_temper", "h_might", "h_growth"]) {
			const it = items.find((i) => i.kind === k && known(i) && readable(i));
			if (
				it &&
				(k !== "s_whet" || r.weapon()) &&
				(k !== "s_temper" || r.shield())
			)
				return { c: "use", item: it.uid };
		}
		const junk =
			items.find((i) => i.kind === "f_moldy") ??
			items.find((i) => BAD_HERBS.has(i.kind) && known(i));
		const canDrop =
			!r.itemAt(p.x, p.y) &&
			!r.onStairs() &&
			!f.wards.includes(p.y * f.layout.w + p.x);
		if (junk && (items.length >= 10 || hpRate > 0.5) && canDrop)
			return { c: "drop", item: junk.uid };
	}
	// 目的が boss の いちばん底：生きている ボス（ほかの 階や fetch では null）
	const boss = r.boss;
	const bossMode = r.bossSpec !== null;
	// 見えている敵に近づく（倒して経験値）
	// 余裕があれば、寝ている敵も先に倒して経験値にする（起こすと危ない敵は放っておく）
	const huntSleepers = hpRate > 0.7 && threats.length === 0;
	const target = visible
		.filter(
			(m) =>
				!m.fuse &&
				(!m.retreating || m.kind === "chimera") &&
				!mdef(m).abilities.some((a) => a.k === "metal" || a.k === "shy") &&
				!m.status.dormant &&
				(m.status.sleep === 0 ||
					(huntSleepers && !["neochi", "tensai", "yuki"].includes(m.kind))),
		)
		.sort((a, b) => dist(a, p) - dist(b, p))[0];
	// 帰り道・階を出るとき（ボスの いる 階は 出ない）
	const leave =
		!boss &&
		(r.s.returning ||
			// 鯖落ち寸前の 階（core/setpiece.ts の escape）は 出口へ 走る
			(f.setpiece?.kind === "escape" && !f.setpiece.done) ||
			(opts.stairsWhenSeen === true && stairsSeen(r)) ||
			f.turns > opts.floorTurnLimit ||
			(opts.leaveWhenNoItems && unseenItems(r) === 0 && !frontierExists(r)));
	if (target && !leave && (dist(target, p) <= 6 || target === boss)) {
		const d = pathStep(r, target, false);
		if (d !== null) return { c: "move", dir: d };
	}
	// 起きている敵がいないうちに 休んで回復する
	if (
		threats.length === 0 &&
		hpRate < 0.85 &&
		p.hunger > 25 * HUNGER_UNIT &&
		f.turns < opts.floorTurnLimit
	)
		return { c: "wait" };
	// いちばん底で持ち物がいっぱいなら、原盤のために1つ捨てる（ボスの 品は 袋の 数の 外）
	if (
		!bossMode &&
		r.s.depth >= r.dungeon.floors &&
		!r.s.returning &&
		items.length >= 20 &&
		!r.itemAt(p.x, p.y) &&
		!r.onStairs()
	) {
		const junk =
			items.find((i) => BAD_HERBS.has(i.kind) && known(i)) ??
			items.find((i) => !r.isEquipped(i) && defOf(i.kind).cat !== "food");
		if (junk) return { c: "drop", item: junk.uid };
	}
	// 集落の key の 人に 話しにいく（目的が event・deliver・bring。core/floor.ts の placeFolk）
	const key = f.folk?.find((x) => x.key);
	if (key && !r.s.returning && (r.eventSpec || r.bringSpec)) {
		if (Math.max(Math.abs(key.x - p.x), Math.abs(key.y - p.y)) <= 1) {
			const d = dirOf(key.x - p.x, key.y - p.y);
			if (d !== null && r.cornerOk(p, d)) return { c: "move", dir: d };
		}
		const spot = DIRS8.map((d) => step(key, d))
			.filter((q) => isFloor(f.layout, q.x, q.y))
			.sort((a, b) => dist(a, p) - dist(b, p))[0];
		if (spot) {
			const d = pathStep(r, spot, true);
			if (d !== null) return { c: "move", dir: d };
		}
	}
	// 見えている道具を拾いにいく
	if (!r.s.returning && items.length < 20) {
		const seen = new Set(r.s.seen);
		const bottomNow = r.s.depth >= r.dungeon.floors;
		const it = f.items
			.filter(
				(fi) =>
					seen.has(fi.item.uid) &&
					!(fi.x === p.x && fi.y === p.y) &&
					// 床に 置いた 避難所スレは 拾えない（拾いにいくと その上に 乗っては
					// 「はりついていて拾えない」を くり返す）
					!r.isWardItem(fi) &&
					!(forgottenItems.get(f)?.has(fi.item.uid) ?? false) &&
					// 捨てた（捨てる）はずの 正体のわかった悪い草・チギュリパンは 拾いにいかない（拾う・捨てるを くり返さない）
					!(BAD_HERBS.has(fi.item.kind) && known(fi.item)) &&
					!(fi.item.kind === "f_moldy") &&
					!(
						(defOf(fi.item.kind).cat === "weapon" &&
							redundantGear(r, fi.item, "weapon")) ||
						(defOf(fi.item.kind).cat === "shield" &&
							redundantGear(r, fi.item, "shield"))
					) &&
					(!bottomNow || bossMode || fi.item.kind === r.dungeon.goal),
			)
			.sort((a, b) => dist(a, p) - dist(b, p))[0];
		if (it) {
			const d = pathStep(r, it, true);
			if (d !== null) return { c: "move", dir: d };
		}
	}
	const bottom = r.s.depth >= r.dungeon.floors && !r.s.returning;
	const stairsKnown = stairsSeen(r);
	if (!bottom && r.onStairs() && (leave || !frontierExists(r))) {
		return { c: "stairs" };
	}
	// 階段への 一歩（見た だけで 道が まだ わからない ときは null。地図スレ・遠くから 見えた など）
	const toStairs =
		stairsKnown && !bottom && !r.onStairs()
			? pathStep(r, f.stairs, true)
			: null;
	// いちばん底では原盤を、帰り道・出るときは階段への 道を 見つけるまで探索する
	// （見えただけで 道の ない 階段へは 行けず、その場で うろうろ していた）
	if (!leave || (toStairs === null && !r.onStairs()) || bottom) {
		const fr = frontier(r);
		if (fr) {
			const d = pathStep(r, fr, true);
			if (d !== null) return { c: "move", dir: d };
		}
		// 地図スレで地形は全部わかっても、原盤そのものは まだ見ていないことがある。
		// 人なら まだ入っていない部屋を見て回るところ。ボットは原盤の部屋へ まっすぐ行く
		if (bottom && !fr) {
			const g = f.items.find((fi) => fi.item.kind === r.dungeon.goal);
			if (g && (g.x !== p.x || g.y !== p.y)) {
				const d = pathStep(r, g, true);
				if (d !== null) return { c: "move", dir: d };
			}
			// ボス：見て 回った あとは ボスの 所へ まっすぐ
			if (boss) {
				const d = pathStep(r, boss, false);
				if (d !== null) return { c: "move", dir: d };
			}
		}
	}
	// 階段へ
	if (stairsKnown && !bottom) {
		if (r.onStairs()) return { c: "stairs" };
		if (toStairs !== null) return { c: "move", dir: toStairs };
	}
	// どこへも行けない：ランダムに歩く
	const dirs = DIRS8.filter(
		(d) =>
			r.canStepTerrain(p, d) &&
			!r.monsterAt(step(p, d).x, step(p, d).y) &&
			!fusedBombs.some((m) => dist(step(p, d), m) <= 2),
	);
	if (dirs.length)
		return { c: "move", dir: dirs[(r.s.turn * 7) % dirs.length] };
	return { c: "wait" };
};

/** (x, y) を となりから なぐれる 向きの 数（床で、角ぬけ できる 向き。斜めは 壁の 角で ふさがる）。 */
const exposure = (r: Run, at: Pos): number => {
	let n = 0;
	for (const d of DIRS8) {
		const q = step(at, d);
		if (isFloor(r.f.layout, q.x, q.y) && r.cornerOk(at, d)) n++;
	}
	return n;
};

/**
 * 通路・入口への 下がり方：maxSteps 歩 以内で、なぐられる 向きが 2 以下の マス（敵より 先に 着ける 所）への
 * 最初の 一歩と 行き先。罠・敵の いる マスは 通らない。近い 順、同じ なら なぐられる 向きの 少ない 順。
 */
const chokeStep = (
	r: Run,
	threats: readonly Pos[],
	maxSteps: number,
): { dir: Dir8; to: Pos } | null => {
	const f = r.f;
	const l = f.layout;
	const w = l.w;
	const start = r.p.y * w + r.p.x;
	const traps = new Set(
		f.traps.filter((t) => t.found).map((t) => t.y * w + t.x),
	);
	const prev = new Map<number, number>([[start, -1]]);
	const depth = new Map<number, number>([[start, 0]]);
	const q = [start];
	let best: { i: number; k: number; e: number } | null = null;
	for (let h = 0; h < q.length; h++) {
		const i = q[h];
		const k = depth.get(i) ?? 0;
		const x = i % w;
		const y = (i - x) / w;
		if (i !== start) {
			const e = exposure(r, { x, y });
			// 敵が 先に 着く・ふさぐ 所は だめ（同じ ときは なぐり合いに なるが、入口の 1体だけ）
			const safe = threats.every((m) => dist(m, { x, y }) >= k);
			if (
				e <= 2 &&
				safe &&
				(!best || k < best.k || (k === best.k && e < best.e))
			)
				best = { i, k, e };
		}
		if (k >= maxSteps) continue;
		for (const d of DIRS8) {
			const n = step({ x, y }, d);
			if (!isFloor(l, n.x, n.y)) continue;
			const ni = n.y * w + n.x;
			if (prev.has(ni) || !f.seen[ni] || traps.has(ni)) continue;
			if (!r.cornerOk({ x, y }, d) || r.monsterAt(n.x, n.y)) continue;
			prev.set(ni, i);
			depth.set(ni, k + 1);
			q.push(ni);
		}
	}
	if (!best) return null;
	let cur = best.i;
	while (prev.get(cur) !== start) cur = prev.get(cur) as number;
	const cx = cur % w;
	const bx = best.i % w;
	return {
		dir: dirOf(cx - r.p.x, (cur - cx) / w - r.p.y) as Dir8,
		to: { x: bx, y: (best.i - bx) / w },
	};
};

/** 通路で 待ちうけて いる 所（階ごと。r.f が かわれば 消える）。 */
const holds = new WeakMap<
	object,
	{ x: number; y: number; since: number; until: number }
>();
/** 待ちうけは 長くても これだけ（動かない 敵が 見えた ままでも 先へ 進む）。 */
const HOLD_MAX = 15;
/** 敵が 見えなく なってから 待つ ターン。 */
const HOLD_LINGER = 4;

const setHold = (r: Run, at: Pos): void => {
	const h = holds.get(r.f);
	const t = r.s.turn;
	if (h && h.x === at.x && h.y === at.y) return;
	holds.set(r.f, { x: at.x, y: at.y, since: t, until: t + HOLD_LINGER + 1 });
};

const frontierExists = (r: Run): boolean => frontier(r) !== null;

/** この 階の 階段を 見たか。 */
const stairsSeen = (r: Run): boolean =>
	r.f.seen[r.f.stairs.y * r.f.layout.w + r.f.stairs.x] === 1;

/** この階の、まだ見ていない道具の数（床・モンスターの持ち物。ボットだけが のぞける）。 */
const unseenItems = (r: Run): number => {
	const seen = new Set(r.s.seen);
	return (
		r.f.items.filter((fi) => !seen.has(fi.item.uid)).length +
		r.f.monsters.filter((m) => m.carry && !seen.has(m.carry.uid)).length
	);
};

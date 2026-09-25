// モンスターの動き（1回の行動）と、特技・なぐったときの効果。
//
// - キリコが見えていれば追いかける（見えなくなったら最後に見た所へ）。見えなければ部屋から部屋へさまよう。
// - 道のりは地形だけの幅優先探索（BFS）で出し、ほかのキャラのいるマスは避ける。
// - 特技は「見えている・まっすぐ並んでいる」などの条件がそろったとき、決まった確率で使う。

import { HIT_RATE, rollDamage } from "./balance";
import { MONSTERS } from "./data/monsters";
import { canSee } from "./fov";
import {
	DIRS8,
	type Dir8,
	DX,
	DY,
	dirOf,
	dist,
	opposite,
	type Pos,
	rotate,
	step,
} from "./geom";
import { defOf, isKeyItem } from "./item";
import { isFloor, roomAt, roomExits, roomTiles } from "./mapgen";
import type { Run } from "./run";
import {
	DEEP,
	DOZE,
	HOLD,
	type Monster,
	type MonsterDef,
	PLAYER_ID,
} from "./types";

export const mdef = (m: Monster): MonsterDef => MONSTERS[m.kind];

/** 呼び名（化けているときは道具の名前）。 */
export const monsterName = (r: Run, m: Monster): string =>
	m.disguise ? r.kindName(m.disguise) : mdef(m).name;

const has = (m: Monster, k: string): boolean =>
	!m.status.sealed && mdef(m).abilities.some((a) => a.k === k);

/** 起こす。byAttack なら深い眠り・金縛りも解ける。 */
export const wakeMonster = (r: Run, m: Monster, byAttack = false): void => {
	const st = m.status;
	if (st.sleep > 0 && (byAttack || st.sleep < DEEP)) {
		st.sleep = 0;
		// 群れはみんな起きる
		if (mdef(m).abilities.some((a) => a.k === "pack"))
			for (const o of r.f.monsters)
				if (o.kind === m.kind && dist(o, m) <= 3) o.status.sleep = 0;
	}
	if (byAttack && st.paralyze >= HOLD) st.paralyze = 0;
	if (byAttack && st.dormant) st.dormant = false;
};

// ───────────────── 道のり ─────────────────

/** 地形だけの距離（target から）。 */
const distanceMap = (r: Run, target: Pos): Int16Array => {
	const l = r.f.layout;
	const d = new Int16Array(l.w * l.h).fill(-1);
	const q: number[] = [target.y * l.w + target.x];
	d[q[0]] = 0;
	for (let h = 0; h < q.length; h++) {
		const i = q[h];
		const x = i % l.w;
		const y = (i - x) / l.w;
		for (const dir of DIRS8) {
			const nx = x + DX[dir];
			const ny = y + DY[dir];
			if (!isFloor(l, nx, ny)) continue;
			const ni = ny * l.w + nx;
			if (d[ni] >= 0) continue;
			if (!r.cornerOk({ x, y }, dir)) continue;
			d[ni] = d[i] + 1;
			q.push(ni);
		}
	}
	return d;
};

/** 道のりの使い回し（同じ階の形・同じ目的地なら同じ地図。階の形ごとに持つ）。 */
const cache = new WeakMap<object, { key: string; map: Int16Array }>();

const distanceTo = (r: Run, target: Pos): Int16Array => {
	const key = `${target.x},${target.y}`;
	const hit = cache.get(r.f.layout);
	if (hit && hit.key === key) return hit.map;
	const map = distanceMap(r, target);
	cache.set(r.f.layout, { key, map });
	return map;
};

/** m が動けるマスか（地形・角・キャラ）。 */
const canEnter = (r: Run, m: Monster, d: Dir8): boolean => {
	const to = step(m, d);
	if (!isFloor(r.f.layout, to.x, to.y)) return false;
	if (!r.cornerOk(m, d)) return false;
	if (r.monsterAt(to.x, to.y)) return false;
	if (r.isPlayerAt(to.x, to.y)) return false;
	return true;
};

const moveTo = (r: Run, m: Monster, d: Dir8): void => {
	const from = { x: m.x, y: m.y };
	const to = step(m, d);
	m.x = to.x;
	m.y = to.y;
	m.dir = d;
	r.emit({ t: "move", id: m.uid, from, to, dir: d });
};

/** target へ1歩近づく。動けたら true。 */
const approach = (r: Run, m: Monster, target: Pos): boolean => {
	const dm = distanceTo(r, target);
	const w = r.f.layout.w;
	const here = dm[m.y * w + m.x];
	let best: Dir8 | null = null;
	let bestD = here < 0 ? 1e9 : here;
	let bestC = dist(m, target);
	for (const d of DIRS8) {
		if (!canEnter(r, m, d)) continue;
		const to = step(m, d);
		const v = dm[to.y * w + to.x];
		if (v < 0) continue;
		const c = dist(to, target);
		if (v < bestD || (v === bestD && c < bestC)) {
			best = d;
			bestD = v;
			bestC = c;
		}
	}
	if (best === null) return false;
	moveTo(r, m, best);
	return true;
};

/** target から遠ざかる。 */
const flee = (r: Run, m: Monster, from: Pos): boolean => {
	let best: Dir8 | null = null;
	let bestC = dist(m, from);
	for (const d of r.rng.shuffle([...DIRS8])) {
		if (!canEnter(r, m, d)) continue;
		const c = dist(step(m, d), from);
		if (c > bestC) {
			best = d;
			bestC = c;
		}
	}
	if (best === null) return false;
	moveTo(r, m, best);
	return true;
};

const randomStep = (r: Run, m: Monster): boolean => {
	const dirs = r.rng.shuffle([...DIRS8]).filter((d) => canEnter(r, m, d));
	if (!dirs.length) return false;
	moveTo(r, m, dirs[0]);
	return true;
};

/** 左折の法則：前・左前・右前・左・右の順に、あいている方へ1歩（後ろへは行かない）。 */
const LEFT_TURN = [0, -1, 1, -2, 2];
const followStep = (r: Run, m: Monster): boolean => {
	for (const k of LEFT_TURN) {
		const d = rotate(m.dir, k);
		if (canEnter(r, m, d)) {
			moveTo(r, m, d);
			return true;
		}
	}
	return false;
};

/** 追いかけを覚えていられる敵か（逃げる敵・つかむ敵・動けない敵は覚えない）。 */
export const canTrack = (m: Monster): boolean => {
	const st = m.status;
	if (m.hp <= 0 || st.sleep > 0 || st.paralyze > 0 || st.confuse > 0)
		return false;
	if (st.blind || st.dormant || m.disguise || m.fuse || m.fleeing) return false;
	// 弱って逃げている（封印・変化で逃げる力が消えたら、もう逃げていない）
	if (m.retreating && has(m, "retreat")) return false;
	return !(has(m, "shy") || has(m, "metal") || has(m, "grab"));
};

/** キリコの居場所を覚える（見えた・となりにいる・投げつけられた）。前の追いかけの続きは捨てる。 */
export const track = (m: Monster, at: Pos): void => {
	m.lastSeen = { x: at.x, y: at.y };
	m.hunt = 0;
	m.stuck = 0;
	m.goal = null;
};

/** キリコの居場所を忘れる（眠った・飛ばされた・姿が変わった）。 */
export const forget = (m: Monster): void => {
	m.lastSeen = null;
	m.hunt = 0;
	m.stuck = 0;
	m.goal = null;
};

/** となり判定（敵の番のあと）：となりにいる敵は キリコの今の位置を覚える。 */
export const noticeAdjacent = (r: Run): void => {
	const p = r.p;
	for (const m of r.f.monsters) if (dist(m, p) <= 1 && canTrack(m)) track(m, p);
};

/** 進めないまま これだけ待ったら（ターン）あきらめる。 */
const GIVE_UP = 5;
/**
 * 見失ったあと たどる歩数の上限（通路・部屋を抜けて次の通路まで。
 * 通路が輪になっていても 回りつづけないように）。
 */
const HUNT_STEPS = 40;

/** さまよう：部屋のどこかを目指す。着いた・行けないなら次の目的地。 */
const wander = (r: Run, m: Monster): boolean => {
	const l = r.f.layout;
	if (!m.goal || (m.goal.x === m.x && m.goal.y === m.y)) {
		const cur = roomAt(l, m.x, m.y);
		const others = l.rooms.filter((rm) => rm.id !== cur);
		const room = others.length ? r.rng.pick(others) : r.rng.pick(l.rooms);
		m.goal = r.rng.pick(roomTiles(room));
	}
	if (approach(r, m, m.goal)) return true;
	m.goal = null;
	return randomStep(r, m);
};

/** m から見て target が8方向のまっすぐな線の上にあり、途中に壁もキャラもないか。 */
const inLine = (r: Run, m: Pos, target: Pos, maxRange: number): Dir8 | null => {
	const dx = target.x - m.x;
	const dy = target.y - m.y;
	if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) return null;
	const n = Math.max(Math.abs(dx), Math.abs(dy));
	if (n === 0 || n > maxRange) return null;
	const d = dirOf(dx, dy);
	if (d === null) return null;
	let p = { x: m.x, y: m.y };
	for (let i = 1; i < n; i++) {
		if (!r.cornerOk(p, d)) return null;
		p = step(p, d);
		if (!isFloor(r.f.layout, p.x, p.y)) return null;
		if (r.monsterAt(p.x, p.y)) return null;
	}
	if (!r.cornerOk(p, d)) return null;
	return d;
};

// ───────────────── 行動 ─────────────────

export const monsterAct = (r: Run, m: Monster): void => {
	if (m.hp <= 0) return;
	const st = m.status;
	const d = mdef(m);
	const p = r.p;
	if (st.fast > 0 && st.fast < 900) st.fast--;
	if (st.slow > 0 && st.slow < 900) st.slow--;
	if (st.paralyze > 0) {
		if (st.paralyze < HOLD) st.paralyze--;
		return;
	}
	if (st.sleep > 0) {
		if (st.sleep < DOZE) st.sleep--;
		// 眠っているあいだに 追いかけは忘れる（起きたら 見えるまで さまよう）
		forget(m);
		return;
	}
	if (m.disguise) return; // 化けているあいだは じっとしている
	if (st.dormant) {
		// 石像：となりに来たら 目を覚まして すぐなぐる
		if (dist(m, p) <= 1) {
			st.dormant = false;
			r.msg(`${d.name}が　動きだした！`, "warn");
			const dir = dirOf(p.x - m.x, p.y - m.y);
			if (dir !== null && r.cornerOk(m, dir)) meleePlayer(r, m);
		}
		return;
	}
	if (m.fuse) return; // ばくだん：止まっている
	const adjacentDir = (): Dir8 | null => {
		if (dist(m, p) !== 1) return null;
		const dir = dirOf(p.x - m.x, p.y - m.y);
		return dir !== null && r.cornerOk(m, dir) ? dir : null;
	};

	// つかむ：動かない
	if (has(m, "grab")) {
		const dir = adjacentDir();
		if (dir !== null) {
			m.dir = dir;
			meleePlayer(r, m);
		}
		return;
	}

	// 混乱：でたらめに動く（キリコのいる方へ行けば なぐる）
	if (st.confuse > 0) {
		st.confuse--;
		const dir = r.rng.pick(DIRS8);
		const to = step(m, dir);
		if (r.isPlayerAt(to.x, to.y) && r.cornerOk(m, dir)) {
			m.dir = dir;
			meleePlayer(r, m);
		} else if (canEnter(r, m, dir)) moveTo(r, m, dir);
		return;
	}

	// 目が見えない：まっすぐ進み、前にいれば なぐる
	if (st.blind) {
		const to = step(m, m.dir);
		if (r.isPlayerAt(to.x, to.y) && r.cornerOk(m, m.dir)) meleePlayer(r, m);
		else if (canEnter(r, m, m.dir)) moveTo(r, m, m.dir);
		else m.dir = r.rng.pick(DIRS8);
		return;
	}

	let sees = canSee(r.f.layout, m, p);
	if (sees && canTrack(m)) track(m, p);

	// 加速（kskボット）：となりで やりあううちに 倍速になる
	const accel = d.abilities.find((a) => a.k === "accel");
	if (
		accel &&
		!st.sealed &&
		sees &&
		dist(m, p) === 1 &&
		(m.seenTurns ?? 0) < (accel as { after: number }).after
	) {
		m.seenTurns = (m.seenTurns ?? 0) + 1;
		if (m.seenTurns >= (accel as { after: number }).after) {
			st.fast = 999;
			st.slow = 0;
			if (r.playerSees(m)) r.msg(`${d.name}が　加速した！　kskst`, "warn");
		}
	}

	// 弱ると逃げて回復（キメラ）
	if (has(m, "retreat")) {
		if (!m.retreating && m.hp <= m.maxHp * 0.4) {
			m.retreating = true;
			if (r.playerSees(m)) r.msg(`${d.name}は　逃げだした`);
		}
		if (m.retreating) {
			m.hp = Math.min(m.maxHp, m.hp + 2);
			if (m.hp >= m.maxHp * 0.8) m.retreating = false;
			else {
				if (sees || dist(m, p) <= 3) {
					if (!flee(r, m, p)) {
						// 追いつめられたら戦う
						const dir = adjacentDir();
						if (dir !== null) {
							m.dir = dir;
							meleePlayer(r, m);
						}
					}
				} else wander(r, m);
				return;
			}
		}
	}

	// 近づくと逃げる（フナムシ）。追いかけてもこない。追いつめられたら戦う
	if (has(m, "shy") && sees) {
		if (dist(m, p) > 2) {
			wander(r, m);
			return;
		}
		if (flee(r, m, p)) return;
		const dir = adjacentDir();
		if (dir !== null) {
			m.dir = dir;
			meleePlayer(r, m);
			return;
		}
	}

	// 逃げる（盗んだあと・メタル）
	if (m.fleeing || has(m, "metal")) {
		const dir = adjacentDir();
		if (has(m, "metal") && dir !== null && r.rng.chance(1 / 3)) {
			m.dir = dir;
			meleePlayer(r, m);
			return;
		}
		if (sees || dist(m, p) <= 3) {
			if (!flee(r, m, p)) randomStep(r, m);
			if (has(m, "fastMove")) flee(r, m, p);
		} else wander(r, m);
		return;
	}

	// 床の道具をさらう
	if (has(m, "pickup") && !m.carry) {
		const here = r.itemAt(m.x, m.y);
		if (here && !isKeyItem(here.item.kind)) {
			r.f.items = r.f.items.filter((i) => i !== here);
			m.carry = here.item;
			if (r.playerSees(m))
				r.msg(`${d.name}は　${r.name(here.item)}を　さらった`, "warn");
			return;
		}
		if (adjacentDir() === null) {
			const target = r.f.items
				.filter((fi) => !isKeyItem(fi.item.kind) && canSee(r.f.layout, m, fi))
				.sort((a, b) => dist(m, a) - dist(m, b))[0];
			if (target && approach(r, m, target)) return;
		}
	}

	// 飛び道具・息・呪文
	if (sees && !st.sealed) {
		for (const a of d.abilities) {
			if (a.k === "ranged") {
				const dir = inLine(r, m, p, 10);
				if (dir !== null && dist(m, p) >= 2 && r.rng.chance(a.rate)) {
					m.dir = dir;
					r.emit({ t: "attack", id: m.uid, dir });
					r.emit({
						t: "bolt",
						from: { x: m.x, y: m.y },
						to: { x: p.x, y: p.y },
						kind: "arrow",
					});
					r.se("throw");
					if (!r.rng.chance(HIT_RATE)) {
						r.msg(`${d.name}は　${a.verb}。しかし　はずれた`);
						r.emit({ t: "miss", id: PLAYER_ID, pos: { x: p.x, y: p.y } });
						return;
					}
					const dmg = rollDamage(a.atk, r.playerDef(), r.dmgRoll());
					r.msg(`${d.name}は　${a.verb}。${dmg}の　ダメージ`);
					r.se("damage");
					r.hurtPlayer(dmg, `${d.name}に　たおされた`);
					return;
				}
			}
			if (a.k === "breath") {
				const dir = inLine(r, m, p, 10);
				if (dir !== null && r.rng.chance(a.rate)) {
					m.dir = dir;
					r.emit({
						t: "bolt",
						from: { x: m.x, y: m.y },
						to: { x: p.x, y: p.y },
						kind: "fire",
					});
					r.se("fire");
					let dmg = r.rng.range(a.dmg[0], a.dmg[1]);
					if (r.shield()?.kind === "fireward") dmg = Math.floor(dmg / 2);
					r.msg(`${d.name}は　炎を　吐いた！　${dmg}の　ダメージ`, "warn");
					r.hurtPlayer(dmg, `${d.name}の　炎で　たおれた`);
					return;
				}
			}
			if (
				a.k === "sleepSpell" &&
				p.status.sleep === 0 &&
				r.rng.chance(a.rate)
			) {
				r.se("spell");
				r.msg(`${d.name}は　眠りの　呪文を　となえた`);
				if (r.hasRing("r_awake")) r.msg("しかし　キリコは　眠らなかった");
				else {
					p.status.sleep = 5;
					r.msg("キリコは　眠ってしまった", "warn");
				}
				return;
			}
			// 目が見えないと、にらまれても 目が合わない
			if (
				a.k === "gaze" &&
				p.status.confuse === 0 &&
				p.status.blind <= 0 &&
				r.rng.chance(a.rate)
			) {
				r.se("spell");
				r.msg(`${d.name}と　目が　合った`);
				p.status.confuse = Math.max(p.status.confuse, 5);
				r.msg("キリコは　混乱した", "warn");
				return;
			}
		}
	}

	// ふらふら動く敵は、となりにいても半分は どこかへ飛んでいく
	const erratic = has(m, "random") && r.rng.chance(1 / 2);
	if (erratic && randomStep(r, m)) return;

	// となりにいれば なぐる
	const adj = adjacentDir();
	if (adj !== null) {
		const ward = r.f.wards.includes(p.y * r.f.layout.w + p.x);
		if (!ward) {
			m.dir = adj;
			meleePlayer(r, m);
			return;
		}
	}

	// 動く
	// 進めなかった：あきらめるまでは その場で待つ。ターンで数える
	// （倍速の2歩目・2回目の行動では 重ねない。2ターンに1回しか動かない敵は 1回で2ターンぶん）
	const stuck = (): boolean => {
		if (m.stuckAt !== r.s.time) {
			m.stuckAt = r.s.time;
			const slowNow =
				st.slow > 0 || (st.fast === 0 && !has(m, "fastAct") && has(m, "slow"));
			m.stuck = (m.stuck ?? 0) + (slowNow ? 2 : 1);
		}
		if ((m.stuck ?? 0) < GIVE_UP) return true;
		m.stuck = 0;
		return false;
	};
	const moveOnce = (): boolean => {
		if (sees) return approach(r, m, p);
		if (m.lastSeen) {
			if (m.lastSeen.x === m.x && m.lastSeen.y === m.y) {
				m.lastSeen = null;
				m.hunt = HUNT_STEPS;
			} else if (approach(r, m, m.lastSeen)) {
				m.stuck = 0;
				return true;
			} else if (stuck()) return false;
			else m.lastSeen = null;
		}
		if (m.hunt) {
			const l = r.f.layout;
			const g = m.goal;
			// 部屋に入ったときに決めた出口へ向かっている
			if (g && (g.x !== m.x || g.y !== m.y)) {
				if (approach(r, m, g)) {
					m.stuck = 0;
					m.hunt--;
					return true;
				}
				if (stuck()) return false;
				m.hunt = 0;
				m.goal = null;
				return wander(r, m);
			}
			m.goal = null;
			const room = roomAt(l, m.x, m.y);
			if (room < 0) {
				// 通路（出口に着いたときも）：左折の法則でたどる
				if (followStep(r, m)) {
					m.stuck = 0;
					m.hunt--;
					return true;
				}
				if (stuck()) return false;
				m.hunt = 0;
			} else {
				// 部屋に入った：入ってきた所とは別の出口へ（出口がほかに無ければ 引き返す）
				const back = step(m, opposite(m.dir));
				const exits = roomExits(l, l.rooms[room]).filter(
					(e) => e.x !== back.x || e.y !== back.y,
				);
				const exit = exits.length ? r.rng.pick(exits) : null;
				if (exit) {
					m.goal = exit;
					if (approach(r, m, exit)) {
						m.stuck = 0;
						m.hunt--;
						return true;
					}
					if (stuck()) return false;
					m.goal = null;
				}
				m.hunt = 0;
			}
		}
		return wander(r, m);
	};
	moveOnce();
	// 倍速で動く（攻撃は1回まで）。2歩目の前に もう一度見る
	if (has(m, "fastMove") && adjacentDir() === null) {
		sees = canSee(r.f.layout, m, p);
		if (sees && canTrack(m)) track(m, p);
		moveOnce();
	}
};

// ───────────────── なぐる ─────────────────

/** モンスターがキリコをなぐる（特技の効果もここ）。 */
export const meleePlayer = (r: Run, m: Monster): void => {
	const d = mdef(m);
	const p = r.p;
	const nm = d.name;
	// 結界の上にいれば、となりからは なぐれない（つかむのも）
	if (r.f.wards.includes(p.y * r.f.layout.w + p.x)) return;
	if (has(m, "grab")) p.status.heldBy = m.uid;
	r.emit({ t: "attack", id: m.uid, dir: m.dir });
	// 盗む：なぐる代わりに
	if (has(m, "steal") && !m.carry) {
		const rate = (d.abilities.find((a) => a.k === "steal") as { rate: number })
			.rate;
		if (r.rng.chance(rate)) {
			const cands = p.items.filter(
				(i) => !r.isEquipped(i) && !isKeyItem(i.kind),
			);
			if (cands.length) {
				const it = r.rng.pick(cands);
				r.removeItem(it);
				m.carry = it;
				m.fleeing = true;
				r.se("flee");
				r.msg(`${nm}は　${r.name(it)}を　盗んだ！`, "warn");
				const to = randomAway(r, m);
				if (to) {
					r.emit({ t: "warp", id: m.uid, from: { x: m.x, y: m.y }, to });
					m.x = to.x;
					m.y = to.y;
				}
				return;
			}
		}
		r.msg(`${nm}は　ようすを　うかがっている`);
		return;
	}
	if (!r.rng.chance(HIT_RATE)) {
		r.se("miss");
		r.emit({ t: "miss", id: PLAYER_ID, pos: { x: p.x, y: p.y } });
		r.msg(`${nm}の　攻撃は　はずれた`);
		return;
	}
	const dmg = rollDamage(d.atk, r.playerDef(), r.dmgRoll());
	r.se("damage");
	r.msg(`${nm}の　攻撃。${dmg}の　ダメージ`);
	if (r.hurtPlayer(dmg, `${nm}に　たおされた`)) return;
	// なぐったときの特技
	if (m.status.sealed) return;
	for (const a of d.abilities) {
		if (!("rate" in a) || !r.rng.chance(a.rate)) continue;
		switch (a.k) {
			case "rust": {
				const sh = r.shield();
				if (!sh) break;
				if (sh.rustproof || sh.kind === "leather" || sh.kind === "mirror") {
					r.msg("しかし　盾は　錆びなかった");
					break;
				}
				sh.plus -= 1;
				sh.known = true;
				r.msg(`盾が　錆びてしまった！（${r.name(sh)}）`, "warn");
				break;
			}
			case "poison": {
				if (r.hasRing("r_purity") || r.shield()?.kind === "scale") {
					r.msg("しかし　毒は　効かなかった");
					break;
				}
				if (p.str > 1) {
					p.str--;
					r.msg("ちからが　1　下がった", "warn");
				}
				break;
			}
			case "drainLv":
				if (r.hasRing("r_ward")) r.msg("しかし　指輪が　守ってくれた");
				else r.drainLevel();
				break;
			case "drainMax": {
				if (r.hasRing("r_ward")) {
					r.msg("しかし　指輪が　守ってくれた");
					break;
				}
				if (r.rng.chance(1 / 2)) {
					p.maxHp = Math.max(1, p.maxHp - 5);
					p.hp = Math.min(p.hp, p.maxHp);
					r.msg("最大HPが　5　下がった", "warn");
				} else if (!r.hasRing("r_purity")) {
					p.maxStr = Math.max(1, p.maxStr - 1);
					p.str = Math.min(p.str, p.maxStr);
					r.msg("最大ちからが　1　下がった", "warn");
				}
				break;
			}
			case "warpPlayer":
				r.msg(`${nm}に　吹きとばされた！`, "warn");
				r.warpPlayer();
				return;
			case "knockback":
				knockPlayer(r, m, 2);
				return;
			case "curse": {
				const eq = [r.weapon(), r.shield(), r.ring()].filter(
					(x): x is NonNullable<typeof x> => !!x && !x.cursed,
				);
				if (!eq.length) break;
				const it = r.rng.pick(eq);
				it.cursed = true;
				it.known = true;
				r.msg(`${r.name(it)}が　のろわれた！`, "warn");
				break;
			}
		}
	}
};

/** キリコを m から遠ざかる向きへ n マス吹きとばす。壁や敵にぶつかると 5 ダメージ。 */
const knockPlayer = (r: Run, m: Monster, n: number): void => {
	const p = r.p;
	const d = dirOf(p.x - m.x, p.y - m.y);
	if (d === null) return;
	const from = { x: p.x, y: p.y };
	let moved = 0;
	for (let i = 0; i < n; i++) {
		const to = step(p, d);
		if (!r.cornerOk(p, d) || !r.isFree(to.x, to.y)) {
			r.msg(`${mdef(m).name}に　吹きとばされて　ぶつかった！`, "warn");
			r.hurtPlayer(5, `${mdef(m).name}に　吹きとばされた`);
			break;
		}
		p.x = to.x;
		p.y = to.y;
		moved++;
	}
	if (moved > 0) {
		p.status.heldBy = null;
		r.emit({ t: "warp", id: PLAYER_ID, from, to: { x: p.x, y: p.y } });
		if (moved === n) r.msg(`${mdef(m).name}に　吹きとばされた！`, "warn");
		r.updateVision();
	}
};

/** キリコから見えない、部屋の空いた床。 */
const randomAway = (r: Run, m: Monster): Pos | null => {
	const l = r.f.layout;
	const spots: Pos[] = [];
	for (const room of l.rooms)
		for (const t of roomTiles(room)) {
			if (!r.isFree(t.x, t.y)) continue;
			if (canSee(l, t, r.p)) continue;
			if (t.x === m.x && t.y === m.y) continue;
			spots.push(t);
		}
	return spots.length ? r.rng.pick(spots) : null;
};

/** モンスターを別の種類に変える（変化の杖）。 */
/** とくちょうで速くなっていたか（加速した kskボット・怒った赤鬼）。杖や草で速くしたのは入らない。 */
const traitFast = (m: Monster): boolean => {
	const accel = mdef(m).abilities.find((a) => a.k === "accel") as
		| { k: "accel"; after: number }
		| undefined;
	return !!m.enraged || (!!accel && (m.seenTurns ?? 0) >= accel.after);
};

/**
 * とくぎを封じる（封印の杖・目つぶし草・毒消し草）。とくちょうで ついていた様子
 * （加速・怒りの速さ・弱って逃げている・爆発しかけ・石像）も いっしょに消える。
 */
export const sealMonster = (m: Monster): void => {
	if (traitFast(m)) m.status.fast = 0;
	m.status.sealed = true;
	m.status.dormant = false;
	m.fuse = false;
	m.retreating = false;
	m.enraged = false;
};

export const transformMonster = (r: Run, m: Monster): void => {
	const cands = Object.values(MONSTERS).filter(
		(d) => d.id !== m.kind && d.floors[0] <= r.levelAt(r.f.depth) + 4,
	);
	const d = r.rng.pick(cands);
	const ratio = m.hp / m.maxHp;
	// 前の姿の とくちょうで 速くなっていたか（杖で速くしたのは そのまま）
	const wasTraitFast = traitFast(m);
	m.kind = d.id;
	m.maxHp = d.hp;
	m.hp = Math.max(1, Math.round(d.hp * ratio));
	m.status.dormant = false;
	m.status.sealed = false;
	m.disguise = null;
	m.fuse = false;
	m.fleeing = false;
	// 前の姿の とくちょうで ついた様子は消える（加速・怒り・逃げ・起き上がり）
	if (wasTraitFast) m.status.fast = 0;
	m.enraged = false;
	m.seenTurns = 0;
	m.retreating = false;
	m.revived = false;
	forget(m);
	if (r.p.status.heldBy === m.uid) r.p.status.heldBy = null;
};

/** 投げた道具・杖の弾が当たったモンスター（プレイヤーから見て d の方向の最初の1体）。 */
export const firstInLine = (
	r: Run,
	from: Pos,
	d: Dir8,
	range: number,
): { hit: Monster | null; last: Pos } => {
	let p = { x: from.x, y: from.y };
	for (let i = 0; i < range; i++) {
		if (!r.cornerOk(p, d)) break;
		const n = step(p, d);
		if (!isFloor(r.f.layout, n.x, n.y)) break;
		p = n;
		const m = r.monsterAt(p.x, p.y);
		if (m) return { hit: m, last: p };
	}
	return { hit: null, last: p };
};

/** 道具のカテゴリ（投げたときの扱い）。 */
export const catOf = (kind: string) => defOf(kind).cat;

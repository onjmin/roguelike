// 自動プレイのボット（調整と、落ちないかの検査用。ゲーム本体では使わない）。
//
// ふつうのプレイヤーがやりそうなことを、単純な優先順で行う：
// 回復 → 食事 → となりの敵をなぐる → 装備の更新 → 識別 → 見えている道具を拾う → 探索 → 階段。

import { HUNGER_UNIT } from "../core/balance";
import { roomsSeenFrom } from "../core/fov";
import { DIRS8, type Dir8, dirOf, dist, type Pos, step } from "../core/geom";
import { defOf, isKnownKind } from "../core/item";
import { isFloor, roomAt, roomExits } from "../core/mapgen";
import { mdef } from "../core/monster";
import type { Run } from "../core/run";
import type { Command, Item } from "../core/types";

const BAD_HERBS = new Set(["h_poison", "h_blind", "h_reel", "h_sleep"]);

export type BotOpts = {
	/** この階に長くいすぎたら階段へ（ターン）。 */
	floorTurnLimit: number;
	/** 階の札を見つけきったら降りる。 */
	leaveWhenNoCards: boolean;
	/** 危ないときに 帰還スレで 地上へ もどる（倒れないモードでは 深い階まで行きたいので 使わない）。 */
	escape: boolean;
};

export const DEFAULT_BOT: BotOpts = {
	floorTurnLimit: 700,
	leaveWhenNoCards: true,
	escape: true,
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

/** ボットの次のコマンド。 */
export const botCommand = (r: Run, opts: BotOpts = DEFAULT_BOT): Command => {
	const cmd = decide(r, opts);
	// 敵の方へ歩いても 向くだけ（見えない敵には ぶつかるだけ）なので、道をふさぐ敵は なぐる。
	// 見えない敵も なぐる（人なら「なにかに　ぶつかった」のあと A を押す。ボットは その1手を省く）
	if (cmd.c === "move") {
		const to = step(r.p, cmd.dir);
		const m = r.monsterAt(to.x, to.y);
		if (m && !m.disguise && r.cornerOk(r.p, cmd.dir))
			return { c: "attack", dir: cmd.dir };
	}
	return cmd;
};

const decide = (r: Run, opts: BotOpts): Command => {
	const p = r.p;
	const f = r.f;
	const items = p.items;
	const visible = f.monsters.filter((m) => r.monsterVisible(m) && !m.disguise);
	const awake = (m: (typeof visible)[number]) =>
		m.status.sleep === 0 && !m.status.dormant && m.status.paralyze === 0;
	const hunting = p.hp / p.maxHp > 0.7;
	const adjacent = visible.filter(
		(m) =>
			dist(m, p) === 1 &&
			(awake(m) ||
				(hunting &&
					m.status.sleep > 0 &&
					!["neochi", "tensai", "yuki"].includes(m.kind))) &&
			r.cornerOk(p, dirOf(m.x - p.x, m.y - p.y) as Dir8),
	);
	// 逃げる敵（フナムシ・弱ったキメラ）は向かってこないので数えない
	const threats = visible.filter(
		(m) =>
			awake(m) &&
			dist(m, p) <= 4 &&
			!m.retreating &&
			!mdef(m).abilities.some((a) => a.k === "shy"),
	);
	const hpRate = p.hp / p.maxHp;
	const known = (it: Item) => isKnownKind(r.s, it.kind);
	const faceAnd = (dir: Dir8, cmd: Command): Command =>
		p.dir !== dir ? { c: "turn", dir } : cmd;

	// 回復
	if (hpRate < 0.35) {
		const heal =
			items.find((i) => i.kind === "h_greater" && known(i)) ??
			items.find((i) => i.kind === "h_heal" && known(i));
		if (heal) return { c: "use", item: heal.uid };
		if (adjacent.length) {
			// 逃げる手：跳び草・転送の杖・眠りの杖
			const m = adjacent[0];
			const dir = dirOf(m.x - p.x, m.y - p.y) as Dir8;
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
				const esc = items.find((i) => i.kind === "s_escape" && known(i));
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
						!["s_appraise", "s_bread", "s_recharge"].includes(i.kind),
				);
				if (scroll) return { c: "use", item: scroll.uid };
			}
		}
	}
	// 遠くの敵に矢を撃つ
	const arrow = items.find((i) => defOf(i.kind).cat === "arrow");
	if (arrow && !adjacent.length) {
		for (const m of threats) {
			const dx = m.x - p.x;
			const dy = m.y - p.y;
			if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) continue;
			if (dist(m, p) < 2) continue;
			const dir = dirOf(dx, dy) as Dir8;
			return faceAnd(dir, { c: "throw", item: arrow.uid, dir });
		}
	}
	// 食事
	if (p.hunger < 12 * HUNGER_UNIT) {
		const food =
			items.find((i) => i.kind === "f_bread") ??
			items.find((i) => i.kind === "f_large") ??
			items.find((i) => i.kind === "f_moldy");
		if (food) return { c: "use", item: food.uid };
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
				r.cornerOk(p, d)
			)
				return { c: "move", dir: d };
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
	if (visible.length === 0) {
		const scroll = items.find(
			(i) => defOf(i.kind).cat === "scroll" && !known(i),
		);
		if (scroll) {
			const need = ["s_appraise", "s_bread", "s_recharge"].includes(
				scroll.kind,
			);
			if (need) {
				const target =
					scroll.kind === "s_recharge"
						? items.find((i) => defOf(i.kind).cat === "staff")
						: scroll.kind === "s_bread"
							? (items.find((i) => i.kind === "h_poison" && known(i)) ??
								items.find((i) => i !== scroll && !r.isEquipped(i)))
							: items.find((i) => i !== scroll && !known(i));
				if (target) return { c: "use", item: scroll.uid, target: target.uid };
			} else return { c: "use", item: scroll.uid };
		}
		for (const k of ["s_whet", "s_temper", "h_might", "h_growth"]) {
			const it = items.find((i) => i.kind === k && known(i));
			if (
				it &&
				(k !== "s_whet" || r.weapon()) &&
				(k !== "s_temper" || r.shield())
			)
				return { c: "use", item: it.uid };
		}
		const junk = items.find((i) => BAD_HERBS.has(i.kind) && known(i));
		const canDrop =
			!r.itemAt(p.x, p.y) &&
			!r.onStairs() &&
			!f.wards.includes(p.y * f.layout.w + p.x);
		if (junk && items.length >= 18 && canDrop)
			return { c: "drop", item: junk.uid };
	}
	// 見えている敵に近づく（倒して経験値）
	// 余裕があれば、寝ている敵も先に倒して経験値にする（起こすと危ない敵は放っておく）
	const huntSleepers = hpRate > 0.7 && threats.length === 0;
	const target = visible
		.filter(
			(m) =>
				!mdef(m).abilities.some((a) => a.k === "metal" || a.k === "shy") &&
				!m.status.dormant &&
				(m.status.sleep === 0 ||
					(huntSleepers && !["neochi", "tensai", "yuki"].includes(m.kind))),
		)
		.sort((a, b) => dist(a, p) - dist(b, p))[0];
	// 帰り道・階を出るとき
	const leave =
		r.s.returning ||
		f.turns > opts.floorTurnLimit ||
		(opts.leaveWhenNoCards && r.cardsLeft() === 0 && !frontierExists(r));
	if (target && !leave && dist(target, p) <= 6) {
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
	// いちばん底で持ち物がいっぱいなら、原盤のために1つ捨てる
	if (
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
	// 見えている道具を拾いにいく
	if (!r.s.returning && items.length < 20) {
		const seen = new Set(r.s.seen);
		const bottomNow = r.s.depth >= r.dungeon.floors;
		const it = f.items
			.filter(
				(fi) =>
					seen.has(fi.item.uid) &&
					!(fi.x === p.x && fi.y === p.y) &&
					// 捨てた（捨てる）はずの 正体のわかった悪い草は 拾いにいかない（拾う・捨てるを くり返さない）
					!(BAD_HERBS.has(fi.item.kind) && known(fi.item)) &&
					(!bottomNow || fi.item.kind === r.dungeon.goal),
			)
			.sort((a, b) => dist(a, p) - dist(b, p))[0];
		if (it) {
			const d = pathStep(r, it, true);
			if (d !== null) return { c: "move", dir: d };
		}
	}
	const bottom = r.s.depth >= r.dungeon.floors && !r.s.returning;
	const sIdx = f.stairs.y * f.layout.w + f.stairs.x;
	const stairsKnown = f.seen[sIdx] === 1;
	if (!bottom && r.onStairs() && (leave || !frontierExists(r))) {
		return { c: "stairs" };
	}
	// いちばん底では原盤を、帰り道・出るときは階段を 見つけるまで探索する
	if (!leave || !stairsKnown || bottom) {
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
		}
	}
	// 階段へ
	if (stairsKnown && !bottom) {
		if (r.onStairs()) return { c: "stairs" };
		const d = pathStep(r, f.stairs, true);
		if (d !== null) return { c: "move", dir: d };
	}
	// どこへも行けない：ランダムに歩く
	const dirs = DIRS8.filter(
		(d) => r.canStepTerrain(p, d) && !r.monsterAt(step(p, d).x, step(p, d).y),
	);
	if (dirs.length)
		return { c: "move", dir: dirs[(r.s.turn * 7) % dirs.length] };
	return { c: "wait" };
};

const frontierExists = (r: Run): boolean => frontier(r) !== null;

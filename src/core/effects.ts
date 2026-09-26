// 道具を使う・投げる。
//
// - 草・スレは使うと正体がわかる。杖は弾が敵に当たって効き目が見えたらわかる。
// - 相手を選ぶスレ（鑑定・充填・飯テロ）は target が要る。無いときは時間を進めずに
//   「えらんで」と知らせる（needsTarget）。キャンセルすれば減らない。

import {
	attackPower,
	EXP_AT,
	HIT_RATE,
	rollDamage,
	THROW_RANGE,
} from "./balance";
import { pickTrapKind } from "./floor";
import { canSee } from "./fov";
import { DIRS8, type Dir8, dist, step } from "./geom";
import { defOf, identifyKind, isKeyItem } from "./item";
import { roomAt, roomTiles } from "./mapgen";
import {
	canTrack,
	firstInLine,
	forget,
	mdef,
	monsterName,
	sealMonster,
	track,
	traitFast,
	transformMonster,
	wakeMonster,
} from "./monster";
import type { Run } from "./run";
import { HOLD, type Item, type Monster } from "./types";

/** 使うときに相手の道具を選ぶ種類。 */
export const TARGET_KINDS: Record<string, "any" | "staff"> = {
	s_appraise: "any",
	s_recharge: "staff",
	s_bread: "any",
};

export const needsTarget = (it: Item): "any" | "staff" | null =>
	TARGET_KINDS[it.kind] ?? null;

/** 使う（食べる・飲む・読む・振る・装備する）。時間が進んだら true。 */
export const useItem = (r: Run, uid: number, target?: number): boolean => {
	const it = r.findItem(uid);
	if (!it) return false;
	const d = defOf(it.kind);
	switch (d.cat) {
		case "weapon":
		case "shield":
		case "ring":
			return r.doEquip(uid);
		case "arrow":
			return throwItem(r, uid, r.p.dir);
		case "goal":
			r.msg("大事に　しまっておこう");
			return false;
		case "food":
			return eat(r, it);
		case "herb":
			return drink(r, it);
		case "scroll":
			return read(r, it, target);
		case "staff":
			return wave(r, it);
	}
};

const consume = (r: Run, it: Item): void => {
	r.removeItem(it);
	r.s.stats.itemsUsed++;
};

// ───────────────── 食べる ─────────────────

const eat = (r: Run, it: Item): boolean => {
	consume(r, it);
	r.se("heal");
	r.msg(`${r.name(it)}を　食べた`);
	if (it.kind === "f_bread") {
		r.feed(50);
		r.msg("おなかが　ふくれた");
	} else if (it.kind === "f_large") {
		r.feed(100);
		r.msg("おなかが　いっぱいに　なった");
	} else {
		r.feed(100);
		r.msg("うっ……　カビている！", "warn");
		if (!r.hasRing("r_purity") && r.p.str > 1) {
			r.p.str--;
			r.msg("ちからが　1　下がった", "warn");
		}
		r.hurtPlayer(5, "くさったパンに　あたった");
	}
	return true;
};

// ───────────────── 飲む ─────────────────

const drink = (r: Run, it: Item): boolean => {
	const p = r.p;
	consume(r, it);
	const newly = identifyKind(r.s, it.kind);
	r.msg(`${r.name(it)}を　飲んだ`);
	if (newly) r.msg(`${r.kindName(it.kind)}　だった！`, "good");
	r.feed(5);
	switch (it.kind) {
		case "h_heal":
		case "h_greater": {
			const big = it.kind === "h_greater";
			r.se("heal");
			if (p.hp >= p.maxHp) {
				p.maxHp += big ? 2 : 1;
				p.hp = p.maxHp;
				r.msg(`最大HPが　${big ? 2 : 1}　上がった`, "good");
			} else {
				const got = r.healPlayer(big ? 100 : 25);
				r.msg(`HPが　${got}　回復した`);
			}
			p.status.blind = 0;
			if (big) p.status.confuse = 0;
			break;
		}
		case "h_poison":
			r.se("damage");
			p.status.confuse = 0;
			if (!r.hasRing("r_purity")) {
				const before = p.str;
				p.str = Math.max(1, p.str - 3);
				if (p.str < before)
					r.msg(`ちからが　${before - p.str}　下がった`, "warn");
			}
			r.hurtPlayer(5, "荒らし草を　飲んで　たおれた");
			break;
		case "h_might":
			r.se("heal");
			if (p.str >= p.maxStr) {
				p.maxStr++;
				p.str = p.maxStr;
				r.msg("最大ちからが　1　上がった", "good");
			} else {
				p.str++;
				r.msg("ちからが　1　回復した", "good");
			}
			break;
		case "h_growth":
			r.se("heal");
			r.gainExp(Math.max(1, expToNext(r)));
			break;
		case "h_swift":
			p.status.fast = 10;
			r.msg("体が　軽くなった！", "good");
			break;
		case "h_blind":
			p.status.blind = 50;
			r.msg("目が　見えなくなった！", "warn");
			break;
		case "h_blink":
			r.warpPlayer();
			break;
		case "h_reel":
			p.status.confuse = 10;
			r.msg("頭が　くらくらする……", "warn");
			break;
		case "h_sleep":
			if (r.hasRing("r_awake")) r.msg("しかし　眠くならなかった");
			else {
				r.sleepPlayer(5);
				r.msg("キリコは　眠ってしまった", "warn");
			}
			break;
		case "h_antidote":
			if (p.str < p.maxStr) {
				p.str = p.maxStr;
				r.msg("ちからが　元に　もどった", "good");
			} else r.msg("何も　起きなかった");
			break;
		case "h_fire": {
			r.se("fire");
			// 炎が とどくのは 目の前の 1マスだけ（そこの 道具も 燃える）
			const { hit, last } = firstInLine(r, p, p.dir, 1);
			r.emit({ t: "bolt", from: { x: p.x, y: p.y }, to: last, kind: "fire" });
			r.msg("キリコは　炎を　吐いた！");
			const under =
				last.x !== p.x || last.y !== p.y ? r.itemAt(last.x, last.y) : undefined;
			if (under && !isKeyItem(under.item.kind)) {
				r.msg(`${r.name(under.item)}が　燃えてしまった`, "warn");
				r.destroyFloorItem(under);
			}
			if (hit) r.damageMonster(hit, r.rng.range(65, 75), "magic");
			break;
		}
		case "h_sight":
			r.f.sight = true;
			p.status.blind = 0;
			r.msg("目が　すみわたった", "good");
			break;
	}
	return true;
};

/** 次のレベルまでの経験値。 */
const expToNext = (r: Run): number => (EXP_AT[r.p.lv] ?? r.p.exp) - r.p.exp;

// ───────────────── 読む ─────────────────

const read = (r: Run, it: Item, target?: number): boolean => {
	const p = r.p;
	const f = r.f;
	const need = needsTarget(it);
	if (need && target === undefined) {
		// どれを？ と聞かれる（キャンセルすれば減らない）
		r.emit({ t: "fx", kind: `pick:${need}`, pos: { x: p.x, y: p.y } });
		return false;
	}
	const tgt = target !== undefined ? r.findItem(target) : undefined;
	if (need && (!tgt || tgt === it)) return false;
	// 帰還スレ：読む前に「地上へ もどる？」と聞く（うっかり 冒険を終えないように）。
	// 聞かれた時点で 正体はわかる（相手を選ぶスレの「どれに？」と同じ）。やめれば 減らない
	if (it.kind === "s_escape" && target === undefined && !r.s.returning) {
		if (identifyKind(r.s, it.kind))
			r.msg(`${r.kindName(it.kind)}　だった！`, "good");
		r.emit({ t: "fx", kind: "confirm:escape", pos: { x: p.x, y: p.y } });
		return false;
	}
	consume(r, it);
	r.se("spell");
	r.msg(`${r.name(it)}を　読んだ`);
	if (identifyKind(r.s, it.kind))
		r.msg(`${r.kindName(it.kind)}　だった！`, "good");
	switch (it.kind) {
		case "s_escape":
			// 持ち帰る品を持っていると 効かない（帰り道は 歩いて のぼる。トルネコ1のリレミトと同じ）
			if (r.s.returning) {
				r.msg("しかし、持ち帰る品が　キリコを　ひきとめた");
				break;
			}
			r.msg("キリコは　地上へ　もどった", "good");
			r.finish("escape", "帰還スレで　地上へ　もどった");
			break;
		case "s_appraise": {
			if (!tgt) break;
			const all = r.rng.chance(1 / 16);
			const list = all ? p.items : [tgt];
			for (const x of list) {
				identifyKind(r.s, x.kind);
				x.known = true;
			}
			r.msg(
				all ? "持ち物が　ぜんぶ　わかった！" : `${r.name(tgt)}　だと　わかった`,
				"good",
			);
			break;
		}
		case "s_whet": {
			const w = r.weapon();
			if (!w) r.msg("しかし　武器を　持っていなかった");
			// −30 以下と ＋99 以上には 効かない（トルネコ1と 同じ）
			else if (w.plus <= -30 || w.plus >= 99)
				r.msg("しかし　何も　起きなかった");
			else {
				w.plus++;
				w.cursed = false;
				w.known = true;
				r.msg(`${r.name(w)}に　なった`, "good");
			}
			break;
		}
		case "s_temper": {
			const sh = r.shield();
			if (!sh) r.msg("しかし　板を　持っていなかった");
			else if (sh.plus <= -30 || sh.plus >= 99)
				r.msg("しかし　何も　起きなかった");
			else {
				sh.plus++;
				sh.cursed = false;
				sh.known = true;
				r.msg(`${r.name(sh)}に　なった`, "good");
			}
			break;
		}
		case "s_uncurse": {
			let n = 0;
			for (const x of [r.weapon(), r.shield(), r.ring()])
				if (x?.cursed) {
					x.cursed = false;
					n++;
				}
			r.msg(n ? "のろいが　とけた" : "何も　起きなかった");
			break;
		}
		case "s_rustproof": {
			const sh = r.shield();
			if (!sh) r.msg("しかし　板を　持っていなかった");
			else {
				sh.rustproof = true;
				sh.cursed = false;
				r.msg("板が　錆びなくなった", "good");
			}
			break;
		}
		case "s_map": {
			const l = f.layout;
			for (let y = 0; y < l.h; y++)
				for (let x = 0; x < l.w; x++) {
					const i = y * l.w + x;
					if (l.tiles[i] !== 0) {
						f.seen[i] = 1;
						for (const d of DIRS8) {
							const n = step({ x, y }, d);
							if (n.x >= 0 && n.y >= 0 && n.x < l.w && n.y < l.h)
								f.seen[n.y * l.w + n.x] = 1;
						}
					}
				}
			for (const t of f.traps) t.found = true;
			r.msg("この階の　ようすが　わかった");
			break;
		}
		case "s_sense":
			f.senseMonsters = true;
			for (const m of f.monsters) if (m.disguise) m.disguise = null;
			r.msg("敵の　気配が　わかる");
			break;
		case "s_treasure":
			f.senseItems = true;
			r.msg("道具の　ありかが　わかる");
			break;
		case "s_hold": {
			let n = 0;
			for (const m of f.monsters)
				if (dist(m, p) <= 1) {
					m.status.paralyze = HOLD;
					n++;
				}
			r.msg(n ? "まわりの　敵が　動かなくなった" : "何も　起きなかった");
			break;
		}
		case "s_blast": {
			r.se("explosion");
			r.emit({ t: "fx", kind: "blast", pos: { x: p.x, y: p.y } });
			const room = roomAt(f.layout, p.x, p.y);
			const targets = f.monsters.filter(
				(m) =>
					dist(m, p) <= 1 || (room >= 0 && roomAt(f.layout, m.x, m.y) === room),
			);
			if (!targets.length) r.msg("何も　起きなかった");
			for (const m of targets) {
				wakeMonster(r, m, true);
				r.damageMonster(m, r.rng.range(5, 35), "blast");
			}
			break;
		}
		case "s_ward":
			// 読んでも 効かない。床に 置くと 効く（run.ts の doDrop）
			r.msg("何も　起きなかった");
			break;
		case "s_recharge": {
			if (!tgt || defOf(tgt.kind).cat !== "staff") {
				r.msg("何も　起きなかった");
				break;
			}
			tgt.charges = Math.min(99, tgt.charges + r.rng.range(1, 5));
			r.msg(`${r.name(tgt)}の　回数が　ふえた`, "good");
			break;
		}
		case "s_bread": {
			if (!tgt || isKeyItem(tgt.kind)) {
				r.msg("何も　起きなかった");
				break;
			}
			if (r.isEquipped(tgt)) {
				if (p.weapon === tgt.uid) p.weapon = null;
				if (p.shield === tgt.uid) p.shield = null;
				if (p.ring === tgt.uid) {
					if (tgt.kind === "r_might") r.applyMight(-tgt.plus);
					p.ring = null;
				}
			}
			const before = r.name(tgt);
			tgt.kind = "f_large";
			tgt.plus = 0;
			tgt.cursed = false;
			tgt.charges = 0;
			tgt.count = 1;
			tgt.known = true;
			r.msg(`${before}が　ぷゆゆパンに　なった`, "good");
			break;
		}
		case "s_snare": {
			const spots = f.layout.rooms
				.flatMap((room) => roomTiles(room))
				.filter(
					(t) =>
						!f.traps.some((x) => x.x === t.x && x.y === t.y) &&
						!r.itemAt(t.x, t.y) &&
						(t.x !== f.stairs.x || t.y !== f.stairs.y) &&
						(t.x !== p.x || t.y !== p.y),
				);
			r.rng.shuffle(spots);
			for (const t of spots.slice(0, 30))
				f.traps.push({
					x: t.x,
					y: t.y,
					kind: pickTrapKind(r, r.levelAt(f.depth)),
					found: false,
				});
			r.msg("どこかで　カチリと　音がした……", "warn");
			break;
		}
	}
	return true;
};

// ───────────────── 杖 ─────────────────

const wave = (r: Run, it: Item): boolean => {
	const p = r.p;
	r.msg(`${r.name(it)}を　振った`);
	if (it.charges <= 0) {
		r.msg("しかし　何も　起きなかった");
		it.known = true;
		return true;
	}
	it.charges--;
	r.s.stats.itemsUsed++;
	r.se("spell");
	const { hit, last } = firstInLine(r, p, p.dir, 99);
	r.emit({ t: "bolt", from: { x: p.x, y: p.y }, to: last, kind: "staff" });
	if (!hit) {
		r.msg("魔法の　弾は　どこかへ　消えた");
		return true;
	}
	// 振っても 正体は わからない（効き目を 見て 当てる。トルネコ1と 同じ）
	staffEffect(r, it.kind, hit);
	return true;
};

/** 杖の効き目（振ったとき・投げて当たったとき）。 */
export const staffEffect = (r: Run, kind: string, m: Monster): void => {
	const nm = monsterName(r, m);
	if (m.disguise) m.disguise = null;
	switch (kind) {
		case "w_bolt":
			r.se("shock");
			wakeMonster(r, m, true);
			r.damageMonster(m, r.rng.range(18, 22), "magic");
			return;
		case "w_reel":
			m.status.confuse = 10;
			r.msg(`${nm}は　混乱した`);
			return;
		case "w_sleep":
			m.status.sleep = 5;
			r.msg(`${nm}は　眠ってしまった`);
			return;
		case "w_seal":
			sealMonster(m);
			r.msg(`${nm}の　とくぎを　封じた`);
			return;
		case "w_change": {
			transformMonster(r, m);
			r.msg(`${nm}は　${mdef(m).name}に　変わった！`);
			return;
		}
		case "w_send": {
			const cands = r.f.layout.rooms
				.flatMap((room) => roomTiles(room))
				.filter((t) => r.isFree(t.x, t.y) && !canSee(r.f.layout, t, r.p));
			const to = cands.length ? r.rng.pick(cands) : null;
			if (to) {
				r.se("warp");
				r.emit({ t: "warp", id: m.uid, from: { x: m.x, y: m.y }, to });
				m.x = to.x;
				m.y = to.y;
				// 飛ばされた敵は キリコを見失う（投げつけられて覚えた位置も忘れる）
				forget(m);
				r.msg(`${nm}を　どこかへ　飛ばした`);
			}
			return;
		}
		case "w_slow":
			// 倍速の 敵は ふつうに もどり、もう 遅い 敵には 効かない
			// （とくちょうで 加速した 敵は、加速ごと 消えて 遅くなる）
			if (m.status.slow > 0) r.msg("しかし　何も　起きなかった");
			else if (m.status.fast > 0 && !traitFast(m)) {
				m.status.fast = 0;
				r.msg(`${nm}の　動きが　もとに　もどった`);
			} else {
				m.status.slow = 999;
				m.status.fast = 0;
				r.msg(`${nm}の　足が　おそくなった`);
			}
			return;
		case "w_edge": {
			const p = r.p;
			const lose = p.hp - Math.ceil(p.hp / 2);
			if (lose > 0) r.hurtPlayer(lose, "諸刃の杖で　たおれた");
			m.hp = 1;
			r.msg(`${nm}の　HPが　1に　なった！`);
			return;
		}
		case "w_split":
			wakeMonster(r, m, true);
			r.splitMonster(m);
			return;
		case "w_haste":
			// 遅い 敵は ふつうに もどり、もう 速い 敵には 効かない
			if (m.status.fast > 0) r.msg("しかし　何も　起きなかった");
			else if (m.status.slow > 0) {
				m.status.slow = 0;
				r.msg(`${nm}の　足が　もとに　もどった`);
			} else {
				m.status.fast = 999;
				r.msg(`${nm}の　動きが　速くなった！`, "warn");
			}
			return;
	}
};

// ───────────────── 投げる ─────────────────

/** 投げる（矢は1本ずつ）。時間が進んだら true。 */
export const throwItem = (r: Run, uid: number, dir: Dir8): boolean => {
	const p = r.p;
	const src = r.findItem(uid);
	if (!src) return false;
	if (isKeyItem(src.kind)) {
		r.msg("これは　手放せない");
		return false;
	}
	if (r.isEquipped(src) && src.cursed) {
		r.msg(`${r.name(src)}は　のろわれていて　外せない！`, "warn");
		return false;
	}
	p.dir = dir;
	const d = defOf(src.kind);
	// 矢は1本だけ分けて飛ばす
	let it = src;
	if (d.cat === "arrow" && src.count > 1) {
		src.count--;
		it = { ...src, uid: r.s.nextUid++, count: 1 };
	} else {
		r.removeItem(src);
	}
	r.se("throw");
	const { hit, last } = firstInLine(r, p, dir, THROW_RANGE);
	r.emit({
		t: "bolt",
		from: { x: p.x, y: p.y },
		to: last,
		kind: d.cat === "arrow" ? "arrow" : "item",
		icon: it.kind,
	});
	if (d.cat !== "arrow") r.msg(`${r.name(it)}を　投げた`);
	if (!hit) {
		r.placeItem(it, last);
		return true;
	}
	const nm = monsterName(r, hit);
	if (hit.disguise) hit.disguise = null;
	if (!r.rng.chance(HIT_RATE)) {
		r.se("miss");
		r.emit({ t: "miss", id: hit.uid, pos: { x: hit.x, y: hit.y } });
		r.msg(`${nm}には　当たらなかった`);
		r.placeItem(it, hit);
		return true;
	}
	wakeMonster(r, hit, true);
	// 投げつけられた敵は、投げてきた所へ向かう（見えない所から投げても）
	if (canTrack(hit)) track(hit, r.p);
	onThrownHit(r, it, hit);
	return true;
};

/**
 * 投げた道具が当たった。当たった道具は なくなる（トルネコ1と 同じ。杖は 回数0でも 振ったのと 同じに 効く）。
 * はずれたときだけ 床に 落ちる（throwItem）。
 */
const onThrownHit = (r: Run, it: Item, m: Monster): void => {
	r.loseItem(it);
	const d = defOf(it.kind);
	const md = mdef(m);
	const undead = md.tags?.includes("undead");
	const small = () => r.rng.range(0, 1);
	switch (d.cat) {
		case "weapon":
		case "arrow": {
			// 投げた武器・矢は「武器の強さ＋ちから」の代わりに その強さで計算する
			const power = (d.atk ?? 0) + it.plus;
			const atk = attackPower(r.p.lv, power);
			const dmg = rollDamage(atk, md.def, r.dmgRoll());
			r.se("attack");
			r.damageMonster(m, dmg, "throw");
			return;
		}
		case "shield":
			r.damageMonster(m, Math.max(1, (d.def ?? 1) - r.rng.int(2)), "throw");
			return;
		case "ring":
			r.damageMonster(m, r.rng.range(1, 2), "throw");
			return;
		case "staff":
			staffEffect(r, it.kind, m);
			return;
		case "herb":
			identifyKind(r.s, it.kind);
			herbOnMonster(r, it.kind, m, undead ?? false, small);
			return;
		default:
			r.damageMonster(m, small(), "throw");
			return;
	}
};

const herbOnMonster = (
	r: Run,
	kind: string,
	m: Monster,
	undead: boolean,
	small: () => number,
): void => {
	const nm = monsterName(r, m);
	const md = mdef(m);
	switch (kind) {
		case "h_heal":
		case "h_greater": {
			const v = kind === "h_greater" ? 100 : 25;
			// 生ける屍には毒。この一撃で たおすと、もう起き上がらない
			if (undead) r.damageMonster(m, v, "holy");
			else {
				m.hp = Math.min(m.maxHp, m.hp + v);
				r.msg(`${nm}の　HPが　回復した`);
			}
			return;
		}
		case "h_swift":
			m.status.fast = 999;
			m.status.slow = 0;
			r.msg(`${nm}の　動きが　速くなった`, "warn");
			return;
		case "h_blind":
			m.status.blind = true;
			sealMonster(m);
			r.msg(`${nm}は　目が　見えなくなった`);
			return;
		case "h_blink": {
			staffEffect(r, "w_send", m);
			return;
		}
		case "h_reel":
			m.status.confuse = 10;
			r.msg(`${nm}は　混乱した`);
			return;
		case "h_sleep":
			m.status.sleep = 5;
			r.msg(`${nm}は　眠ってしまった`);
			return;
		case "h_antidote":
			if (md.tags?.includes("plant") || md.tags?.includes("doll")) {
				sealMonster(m);
				r.damageMonster(m, 50, "throw");
			} else r.msg(`${nm}には　効かなかった`);
			return;
		case "h_fire":
			r.se("fire");
			r.damageMonster(m, r.rng.range(35, 40), "throw");
			return;
		default:
			r.damageMonster(m, small(), "throw");
	}
};

/** 向きの一覧（UI 用）。 */
export const ALL_DIRS: readonly Dir8[] = DIRS8;

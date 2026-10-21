// 見せ場の 階（core/setpiece.ts）の 試験（pnpm test で いっしょに 動く）。
// 籠城（電池板 15階）・脱出（電池板 11階）・潜入（おんキム 10階）。

import { Run } from "../core/run";
import {
	ALARM_FOES,
	ESCAPE_RES,
	GUARD_SIGHT,
	GUARDS,
	SETPIECES,
	SIEGE_WAVES,
} from "../core/setpiece";
import type { TestResult } from "./monsterTests";

class Fail extends Error {}
const ok = (cond: unknown, why: string): void => {
	if (!cond) throw new Fail(why);
};

const CASES: { name: string; run: () => void }[] = [];
const test = (name: string, run: () => void) => CASES.push({ name, run });

/** その 板の その 階に 着いた 冒険（キリコは 倒れない）。 */
const at = (seed: string, d: "deep" | "onkimu", depth: number): Run => {
	const r = Run.create(seed, d, [], d === "deep" ? "boss" : "fetch");
	r.enterFloor(depth, false);
	r.p.maxHp = 9999;
	r.p.hp = 9999;
	return r;
};

test("見せ場は 電池板の 11・15階と おんキムの 10階だけ（本編の 乱数の 順は かわらない）", () => {
	ok(
		Object.keys(SETPIECES).sort().join(",") === "deep,onkimu",
		`boards ${Object.keys(SETPIECES)}`,
	);
	const r = Run.create("sp-main", "main", [], "fetch");
	for (let d = 1; d <= 3; d++) {
		r.enterFloor(d, false);
		ok(!r.f.setpiece, `main ${d}F has a set piece`);
	}
});

test("脱出：レス800 から、出口の 階段は はじめから 見え、止まると 加速し、階段で 出れば 果たす", () => {
	const r = at("sp-esc", "deep", 11);
	ok(r.f.setpiece?.kind === "escape", "no escape on 11F");
	ok(r.f.res === ESCAPE_RES, `res ${r.f.res}`);
	const l = r.f.layout;
	ok(
		r.f.seen[r.f.stairs.y * l.w + r.f.stairs.x] === 1,
		"the stairs are hidden",
	);
	r.act({ c: "wait" });
	const one = r.f.res;
	r.act({ c: "wait" });
	ok(r.f.res - one >= 4, `standing still adds ${r.f.res - one}`);
	r.p.x = r.f.stairs.x;
	r.p.y = r.f.stairs.y;
	r.act({ c: "stairs" });
	ok(r.s.piecesWon?.includes(11), "escaping does not count");
	ok(r.s.depth === 12, `depth ${r.s.depth}`);
});

test("脱出：1000で 落ちて また 着いても、見せ場は 1度きり", () => {
	const r = at("sp-again", "deep", 11);
	r.enterFloor(10, false);
	r.enterFloor(11, false);
	ok(!r.f.setpiece, "the escape came back");
});

test("籠城：荒らしが 3波 湧き、3波目に 仲間が 加勢し、ぜんぶ たおすと 全回復と 経験値", () => {
	const r = at("sp-siege", "deep", 15);
	ok(r.f.setpiece?.kind === "siege", "no siege on 15F");
	const exp = r.p.exp;
	let waves = 0;
	for (let t = 0; t < 200 && !r.s.piecesWon?.includes(15); t++) {
		r.act({ c: "wait" });
		const sp = r.f.setpiece;
		if (!sp) break;
		waves = Math.max(waves, sp.wave);
		// 湧いた 荒らしは その場で たおす
		for (const uid of sp.foes) {
			const m = r.f.monsters.find((x) => x.uid === uid && x.hp > 0);
			if (m) r.killMonster(m, true);
		}
	}
	ok(waves === SIEGE_WAVES.length, `${waves} waves`);
	ok(r.s.piecesWon?.includes(15), "holding the thread does not count");
	ok(r.p.exp > exp, "no exp");
	ok(r.p.hp === r.p.maxHp, "not healed");
});

test("潜入：壺の まわりに 見張りが 眠り、近づくと 見つかって 増援。見つからずに 拾えば 果たす", () => {
	const r = at("sp-stealth", "onkimu", 10);
	const sp = r.f.setpiece;
	ok(sp?.kind === "stealth", "no stealth on 10F");
	if (!sp) return;
	ok(sp.guards.length === GUARDS, `${sp.guards.length} guards`);
	ok(r.f.mapped, "Roze did not scout the floor");
	const guards = r.f.monsters.filter((m) => sp.guards.includes(m.uid));
	ok(
		guards.every((g) => g.status.sleep > 0),
		"a guard is awake on arrival",
	);
	// 近づく → 見つかる
	const g = guards[0];
	const before = r.f.monsters.length;
	r.p.x = g.x;
	r.p.y = g.y;
	for (const d of [
		[GUARD_SIGHT, 0],
		[-GUARD_SIGHT, 0],
		[0, GUARD_SIGHT],
		[0, -GUARD_SIGHT],
	] as const)
		if (r.isFree(g.x + d[0], g.y + d[1])) {
			r.p.x = g.x + d[0];
			r.p.y = g.y + d[1];
			break;
		}
	r.act({ c: "wait" });
	ok(sp.alarm, "nobody noticed");
	ok(r.f.monsters.length >= before + ALARM_FOES - 1, "no reinforcements");
	// べつの 冒険：見つからずに 壺を 拾う
	const q = at("sp-stealth", "onkimu", 10);
	const goal = q.f.items.find((x) => x.item.kind === q.dungeon.goal);
	if (!goal) throw new Fail("no goal");
	for (const uid of q.f.setpiece?.guards ?? []) {
		const m = q.f.monsters.find((x) => x.uid === uid);
		if (m) m.hp = 0;
	}
	q.f.monsters = q.f.monsters.filter((m) => m.hp > 0);
	q.p.x = goal.x;
	q.p.y = goal.y;
	q.act({ c: "pickup" });
	q.act({ c: "wait" });
	ok(q.s.piecesWon?.includes(10), "the heist does not count");
});

export const runSetPieceTests = (): TestResult[] =>
	CASES.map((c) => {
		try {
			c.run();
			return { id: "setpiece", name: c.name, ok: true };
		} catch (e) {
			return {
				id: "setpiece",
				name: c.name,
				ok: false,
				reason: e instanceof Error ? e.message : String(e),
			};
		}
	});

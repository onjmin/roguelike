// 罠（踏むと 3/4 の確率で動く。罠よけの指輪なら かからない）。

import { rollDamage, TRAP_CHANCE } from "./balance";
import { DIRS8, dist, step } from "./geom";
import { isKeyItem } from "./item";
import { isBoss } from "./monster";
import type { Run } from "./run";
import type { Trap } from "./types";

const TRAP_NAME: Record<string, string> = {
	bear: "トラばさみ",
	acid: "酸の罠",
	sleep: "眠りガスの罠",
	trip: "転び石",
	mine: "地雷",
	arrow: "矢の罠",
	dart: "毒矢の罠",
	warp: "転移床",
	pit: "落とし穴",
};

export const trapName = (t: Trap): string => TRAP_NAME[t.kind];

export const triggerTrap = (r: Run, t: Trap): void => {
	if (r.hasRing("r_trap")) return; // 踏んだことも出ない
	t.found = true;
	const p = r.p;
	r.msg(`${trapName(t)}を　踏んだ！`, "warn");
	if (!r.rng.chance(TRAP_CHANCE)) {
		r.msg("しかし　罠は　動かなかった");
		return;
	}
	switch (t.kind) {
		case "bear":
			p.status.trapped = 5;
			r.se("bearTrap");
			r.msg("足を　はさまれた！", "warn");
			return;
		case "acid": {
			const sh = r.shield();
			if (!sh) {
				r.msg("しかし　板を　持っていなかった");
				return;
			}
			if (sh.rustproof || sh.kind === "leather" || sh.kind === "mirror") {
				r.msg("しかし　板は　錆びなかった");
				return;
			}
			sh.plus--;
			sh.known = true;
			r.se("debuff");
			r.msg(`板が　錆びてしまった！（${r.name(sh)}）`, "warn");
			return;
		}
		case "sleep":
			if (r.hasRing("r_awake")) {
				r.msg("しかし　眠くならなかった");
				return;
			}
			r.sleepPlayer(5);
			r.msg("キリコは　眠ってしまった", "warn");
			return;
		case "trip": {
			r.msg("キリコは　転んでしまった！", "warn");
			const cands = p.items.filter(
				(i) => !r.isEquipped(i) && !isKeyItem(i.kind),
			);
			if (!cands.length) return;
			const it = r.rng.pick(cands);
			r.removeItem(it);
			const ahead = step(step(p, p.dir), p.dir);
			r.msg(`${r.name(it)}を　落とした`);
			r.placeItem(it, r.isFree(ahead.x, ahead.y) ? ahead : step(p, p.dir));
			return;
		}
		case "mine": {
			r.se("explosion");
			r.emit({ t: "fx", kind: "explosion", pos: { x: p.x, y: p.y }, r: 1 });
			r.msg("地雷が　爆発した！", "warn");
			// 爆風で 消え去る（経験値なし・落とす 道具も 燃える。巻きこまれた 炎上案件も 誘爆しない。トルネコ1と 同じ）。
			// ボスは 消え去らず、最大HPの 1/4 の ダメージ（ほかの 敵の あとで。たおれたら その場で 冒険が 終わる）
			const near = r.f.monsters.filter((m) => dist(m, p) <= 1);
			for (const m of near) if (!isBoss(m)) r.killMonster(m, false, true);
			for (const fi of [...r.f.items])
				if (dist(fi, p) <= 1) r.destroyFloorItem(fi);
			for (const m of near) if (isBoss(m)) r.blastBoss(m);
			if (!r.s.end) r.hurtPlayer(Math.ceil(p.hp / 2), "地雷で　たおれた");
			return;
		}
		case "arrow":
		case "dart": {
			r.se("damage");
			const dmg = rollDamage(8, r.playerDef(), r.dmgRoll());
			r.msg(`矢が　飛んできた！　${dmg}の　ダメージ`);
			if (r.hurtPlayer(dmg, `${trapName(t)}で　たおれた`)) return;
			if (t.kind === "dart" && !r.hasRing("r_purity") && p.str > 1) {
				p.str--;
				r.se("debuff");
				r.msg("ちからが　1　下がった", "warn");
			}
			return;
		}
		case "warp":
			r.warpPlayer();
			return;
		case "pit": {
			// 上りの 板は 吹き上げ（逃げる 音）、下りは 落ちる 音
			r.se(r.dungeon.up ? "flee" : "fall");
			const dmg = rollDamage(8, r.playerDef(), r.dmgRoll());
			// 上りの 板では 穴から 吹き上げられる
			r.msg(r.dungeon.up ? "吹き上げの　穴だ！" : "落とし穴に　落ちた！");
			if (r.hurtPlayer(dmg, "落とし穴で　たおれた")) return;
			r.fallDown();
			return;
		}
	}
};

/** 罠を置ける向き（未使用の小道具）。 */
export const AROUND = DIRS8;

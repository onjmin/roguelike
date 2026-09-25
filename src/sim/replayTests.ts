// リプレイの試験（pnpm test で monsterTests といっしょに動く）。
//
// - ボットに遊ばせた冒険（途中で何度も中断セーブ→読み直しをはさむ）を、シードと記録から
//   入れなおすと、終わりの状態が 1文字もちがわずに同じになるか。
// - 途中の指紋（#…）が ぜんぶ合うか。記録を1つ抜くと、指紋で ずれがわかるか。
// - コマンドの短い文字が、どの形でも 元にもどるか。

import {
	decodeCmd,
	digest,
	encodeCmd,
	parseReplay,
	type ReplayStep,
} from "../core/replay";
import { Run } from "../core/run";
import { deserializeRun, serializeRun } from "../core/serial";
import type { Command } from "../core/types";
import { botCommand } from "./bot";
import type { TestResult } from "./monsterTests";

class Fail extends Error {}
const ok = (cond: unknown, why: string): void => {
	if (!cond) throw new Fail(why);
};

/** ボットに遊ばせる（every 行動ごとに 中断セーブ→読み直し）。 */
const playBot = (seed: string, maxActs: number, every: number): Run => {
	let run = Run.create(seed);
	for (let i = 1; i <= maxActs && !run.s.end; i++) {
		run.act(botCommand(run));
		if (i % every === 0) run = new Run(deserializeRun(serializeRun(run.s)));
	}
	return run;
};

/** 記録を入れなおす。ずれた（指紋が合わない）ら、何こま目かを返す。 */
const replay = (
	seed: string,
	steps: ReplayStep[],
): { run: Run; driftAt: number; checks: number } => {
	const run = Run.create(seed);
	let checks = 0;
	for (let i = 0; i < steps.length; i++) {
		const st = steps[i];
		if (st.kind === "cmd") run.act(st.cmd);
		else {
			checks++;
			if (digest(run.s) !== st.digest) return { run, driftAt: i, checks };
		}
	}
	return { run, driftAt: -1, checks };
};

const CASES: { name: string; run: () => void }[] = [];
const test = (name: string, run: () => void) => CASES.push({ name, run });

test("encode/decode round-trips every command shape", () => {
	const cmds: Command[] = [
		{ c: "move", dir: 3 },
		{ c: "move", dir: 7, noPickup: true },
		{ c: "attack" },
		{ c: "attack", dir: 0 },
		{ c: "turn", dir: 5 },
		{ c: "wait" },
		{ c: "pickup" },
		{ c: "use", item: 12 },
		{ c: "use", item: 12, target: 40 },
		{ c: "throw", item: 9 },
		{ c: "throw", item: 9, dir: 6 },
		{ c: "drop", item: 3 },
		{ c: "equip", item: 4 },
		{ c: "unequip", item: 4 },
		{ c: "swap", item: 8 },
		{ c: "stairs" },
		{ c: "name", kind: "s_map", text: "地図かも,たぶん.○" },
		{ c: "name", kind: "h_heal", text: "" },
	];
	for (const c of cmds) {
		const t = encodeCmd(c);
		ok(!t.includes(","), `token has a comma: ${t}`);
		ok(
			JSON.stringify(decodeCmd(t)) === JSON.stringify(c),
			`${JSON.stringify(c)} → ${t} → ${JSON.stringify(decodeCmd(t))}`,
		);
	}
});

test("a corrupted record stops cleanly instead of throwing", () => {
	// 壊れた % の並び・数でない向き・知らない頭 → そこまで（例外にしない）
	for (const bad of ["n%E0.x", "mx", "tq", "u", "Tz.1", "zz", ""])
		ok(decodeCmd(bad) === null, `decoded a bad token: ${JSON.stringify(bad)}`);
	const steps = parseReplay("w,m2,n%E0.x,w");
	ok(
		steps.length === 2 && steps[1].kind === "cmd",
		`parse did not stop at the bad token (${steps.length} steps)`,
	);
});

test("a bot run (with suspend/resume) replays to the identical state", () => {
	for (const seed of ["rp-1", "rp-2", "rp-3", "rp-4", "rp-5"]) {
		const played = playBot(seed, 1200, 250);
		const text = played.s.replay;
		ok(typeof text === "string" && text.length > 0, `${seed}: no record`);
		const steps = parseReplay(text as string);
		const n = steps.filter((x) => x.kind === "cmd").length;
		ok(
			n === played.s.replayN,
			`${seed}: ${n} commands vs replayN ${played.s.replayN}`,
		);
		const { run, driftAt, checks } = replay(seed, steps);
		ok(checks > 0, `${seed}: no checkpoints in ${n} commands`);
		ok(driftAt < 0, `${seed}: drifted at step ${driftAt}`);
		ok(
			serializeRun(run.s) === serializeRun(played.s),
			`${seed}: the replayed state differs (turn ${run.s.turn} vs ${played.s.turn}, depth ${run.s.depth} vs ${played.s.depth})`,
		);
	}
});

test("a run that ended replays to the same ending", () => {
	// 倒れるまで遊ばせて、同じ所・同じ理由で倒れるか
	let played: Run | null = null;
	for (let i = 0; i < 20 && !played?.s.end; i++)
		played = playBot(`rp-end-${i}`, 8000, 500);
	ok(played?.s.end, "harness: no run ended within 8000 actions");
	const p = played as Run;
	const { run, driftAt } = replay(p.s.seed, parseReplay(p.s.replay as string));
	ok(driftAt < 0, `drifted at step ${driftAt}`);
	ok(
		JSON.stringify(run.s.end) === JSON.stringify(p.s.end),
		`ending ${JSON.stringify(run.s.end)} vs ${JSON.stringify(p.s.end)}`,
	);
});

test("a missing command is caught by the next checkpoint", () => {
	const played = playBot("rp-drift", 600, 1000);
	const steps = parseReplay(played.s.replay as string);
	// 最初の指紋より前の「動く」を1つ抜く
	const firstCheck = steps.findIndex((x) => x.kind === "check");
	ok(firstCheck > 0, "harness: no checkpoint");
	const drop = steps.findIndex(
		(x, i) => i < firstCheck && x.kind === "cmd" && x.cmd.c === "move",
	);
	ok(drop >= 0, "harness: no move before the first checkpoint");
	const tampered = steps.filter((_, i) => i !== drop);
	const { driftAt } = replay("rp-drift", tampered);
	ok(driftAt >= 0, "dropping a move was not noticed");
});

test("a run from an old save (no record) does not start recording", () => {
	const run = Run.create("rp-old");
	run.s.replay = null;
	run.act({ c: "wait" });
	ok(run.s.replay === null, "an old save started a partial record");
});

export const runReplayTests = (): TestResult[] =>
	CASES.map((c) => {
		try {
			c.run();
			return { id: "replay", name: c.name, ok: true };
		} catch (e) {
			return {
				id: "replay",
				name: c.name,
				ok: false,
				reason: e instanceof Error ? e.message : String(e),
			};
		}
	});

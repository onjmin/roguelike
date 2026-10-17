// 同行者（筋で 決まる ゲスト。core/guest.ts・data/people/companions.ts）の 試験（pnpm test）。
// いちばん 大事なのは「重ならない」（作者の 指示）：ボットで 長く 遊ばせて、どの ターンでも 同行者・キリコ・敵が
// 同じ マスに いない こと、同行者が 壁に いない ことを 見る。

import { spawnMonster } from "../core/floor";
import { DIRS8, dist, step } from "../core/geom";
import { GUEST_TALK, GUESTS, guestChat, guestHere } from "../core/guest";
import { isFloor } from "../core/mapgen";
import { Run } from "../core/run";
import { serializeRun } from "../core/serial";
import type { Command, DungeonId, GuestId } from "../core/types";
import {
	ESCORT_MSG,
	ESCORTS,
	escortFor,
	openEscorts,
} from "../data/people/companions";
import { diveResLine } from "../data/story/synopsis";
import {
	acceptEscort,
	doneEscortThanks,
	loadEscort,
	noteEscortRun,
	pendingThanks,
} from "../engine/escort";
import { botCommand } from "./bot";
import { swapStorage } from "./jikkyoTests";
import type { TestResult } from "./monsterTests";

class Fail extends Error {}
const ok = (cond: unknown, why: string): void => {
	if (!cond) throw new Fail(why);
};
const CASES: { name: string; run: () => void | Promise<void> }[] = [];
const test = (name: string, run: () => void | Promise<void>) =>
	CASES.push({ name, run });

const width = (s: string) =>
	[...s].reduce((n, c) => n + (/[\x20-\x7e｡-ﾟ]/.test(c) ? 0.5 : 1), 0);

/** 同行者つきの 冒険（見たい 階は 既定で 着かない 深さ）。 */
const make = (seed: string, d: DungeonId, g: GuestId | null, goal = 99): Run =>
	Run.create(seed, d, [], "fetch", true, "kiriko", g ? { id: g, goal } : null);

/** いまの 階で 重なって いないか（同行者・キリコ・敵）。 */
const noOverlap = (r: Run, where: string): void => {
	const cells = new Map<string, string>();
	const put = (x: number, y: number, who: string) => {
		const k = `${x},${y}`;
		ok(!cells.has(k), `${where}: ${who} on ${cells.get(k)} at ${k}`);
		cells.set(k, who);
	};
	if (!r.playerInWall()) put(r.p.x, r.p.y, "player");
	for (const m of r.f.monsters) if (m.hp > 0) put(m.x, m.y, `m${m.uid}`);
	const g = guestHere(r);
	if (g) {
		ok(isFloor(r.f.layout, g.x, g.y), `${where}: guest in a wall`);
		put(g.x, g.y, "guest");
	}
};

const PAIRS: [DungeonId, GuestId][] = [
	["deep", "zero"],
	["tropical", "feris"],
];

test("重ならない：ボットで 遊ばせて どの ターンも 同行者・キリコ・敵が 同じ マスに いない", () => {
	for (const [d, g] of PAIRS)
		for (const seed of ["g1", "g2", "g3", "g4"]) {
			const r = make(`guest-${seed}`, d, g);
			noOverlap(r, `${d}/${seed} start`);
			for (let i = 0; i < 2500 && !r.s.end; i++) {
				r.act(botCommand(r));
				noOverlap(r, `${d}/${seed} turn ${r.s.turn}`);
			}
		}
});

test("ついてくる：階に 着くと キリコの そばに 立ち、ひとこと。たいてい キリコの 近くに いる", () => {
	for (const [d, g] of PAIRS) {
		// ワナで とばされると しばらく はなれるので、いくつかの 種で ならす
		let near = 0;
		let n = 0;
		for (const seed of ["guest-near", "near-b", "near-c"]) {
			const r = make(seed, d, g);
			const gs = guestHere(r);
			ok(gs && dist(gs, r.p) <= 3, `${d}: not beside Kiriko on arrival`);
			ok(
				r.s.log.some((l) => l === `${GUESTS[g].name}「${GUESTS[g].first}」`),
				`${d}: no first line`,
			);
			for (let i = 0; i < 1500 && !r.s.end; i++) {
				r.act(botCommand(r));
				const h = guestHere(r);
				if (!h) continue;
				n++;
				if (dist(h, r.p) <= 3) near++;
			}
		}
		ok(!n || near / n > 0.7, `${d}: near only ${near}/${n}`);
	}
});

test("同じに 始まる：同じ シード・同じ 手で 同じ 終わり（リプレイ）。同行者の いない 冒険は guest を 書かない", () => {
	const a = make("guest-replay", "deep", "zero");
	const cmds: Command[] = [];
	for (let i = 0; i < 800 && !a.s.end; i++) {
		const c = botCommand(a);
		cmds.push(c);
		a.act(c);
	}
	const b = make("guest-replay", "deep", "zero");
	for (const c of cmds) b.act(c);
	ok(serializeRun(a.s) === serializeRun(b.s), "the replay drifted");
	const plain = make("guest-replay", "deep", null);
	ok(plain.s.guest === undefined, "a run without a guest wrote guest");
});

test("入れかわる：キリコが 同行者の マスへ 歩くと 入れかわる", () => {
	const r = make("guest-swap", "deep", "zero");
	r.f.monsters = [];
	const g = guestHere(r);
	ok(g, "no guest");
	if (!g) return;
	const d = DIRS8.find((x) => {
		const t = step(r.p, x);
		return t.x === g.x && t.y === g.y;
	});
	ok(d !== undefined, "guest is not next to Kiriko");
	if (d === undefined) return;
	const from = { x: r.p.x, y: r.p.y };
	const to = { x: g.x, y: g.y };
	r.act({ c: "move", dir: d });
	const h = guestHere(r);
	ok(r.p.x === to.x && r.p.y === to.y, "Kiriko did not step in");
	ok(h && dist(h, r.p) === 1, "the guest is not beside Kiriko after the swap");
	ok(h && !(h.x === to.x && h.y === to.y), "overlap after the swap");
	ok(from, "");
});

test("なぐられる・帰る：キリコの となりに いない 敵は 同行者を なぐる。たおれると 村へ 帰り、冒険は つづく", () => {
	const r = make("guest-hit-4", "deep", "zero");
	r.f.monsters = [];
	const g = guestHere(r);
	ok(g, "no guest");
	if (!g) return;
	g.hp = 1;
	// 同行者の となりで、キリコから 2マス 以上 はなれた 床に 敵を 置く
	const spot = DIRS8.map((d) => step(g, d)).find(
		(q) => r.isFree(q.x, q.y) && dist(q, r.p) >= 2,
	);
	ok(spot, "no spot beside the guest");
	if (!spot) return;
	const m = spawnMonster(r, "tousuko", spot, { single: true });
	ok(m, "no monster");
	if (!m) return;
	m.status.sleep = 0;
	for (let i = 0; i < 30 && !r.s.guest?.down; i++) {
		// キリコは その場で 待つ（同行者が 先に なぐって たおすことも あるので、敵が 消えたら 置きなおす）
		if (!r.f.monsters.some((x) => x.hp > 0)) {
			const q = DIRS8.map((d) => step(g, d)).find(
				(c) => r.isFree(c.x, c.y) && dist(c, r.p) >= 2,
			);
			if (!q) break;
			const n = spawnMonster(r, "tousuko", q, { single: true });
			if (n) n.status.sleep = 0;
		}
		g.hp = 1;
		r.act({ c: "wait" });
	}
	ok(r.s.guest?.down, "the guest never went down");
	ok(!r.s.end, "the run ended with the guest");
	ok(
		r.s.log.some((l) => l === `${GUESTS.zero.name}は村へ帰っていった`),
		"no going-home line",
	);
	ok(guestHere(r) === null, "a downed guest is still on the floor");
});

test("同行の 依頼：持ち帰った 板だけ 掲示板に 出る。はたした 依頼は 出ない", () => {
	const all = 1e9;
	ok(openEscorts([], 7, all, []).length === 0, "requests before any board");
	const k = openEscorts(["kinoko"], 7, all, []);
	ok(
		k.some((e) => e.id === "roze_kinoko"),
		"no きのこ板 request",
	);
	ok(
		!openEscorts(["kinoko"], 7, all, ["roze_kinoko"]).some(
			(e) => e.id === "roze_kinoko",
		),
		"a done request is still up",
	);
	// 依頼主は みんな はじめから 町に いる
	ok(
		openEscorts(["tropical"], 0, 0, []).some((e) => e.who === "feris"),
		"feris does not ask at the start",
	);
	// 引き受けた 依頼の 板だけ ついてくる。主人公と 同じ 人は 来ない
	ok(
		escortFor("kinoko", "roze_kinoko", ["kinoko"], 7, all, "kiriko")?.who ===
			"roze",
		"ロゼ does not come",
	);
	ok(
		escortFor("deep", "roze_kinoko", ["kinoko", "deep"], 7, all, "kiriko") ===
			null,
		"came to another board",
	);
	ok(
		escortFor("kinoko", "roze_kinoko", ["kinoko"], 7, all, "roze") === null,
		"ロゼ came with herself",
	);
	ok(
		escortFor("kinoko", null, ["kinoko"], 7, all, "kiriko") === null,
		"came without a request",
	);
});

test("見たかった 階：着くと ひとこと 言って 満足して 帰る（冒険は つづく）。帰ると お礼、依頼は すむ", () => {
	const r = make("guest-goal", "kinoko", "roze", 2);
	ok(guestHere(r), "no guest on 1F");
	r.enterFloor(2, false);
	ok(r.s.guest?.done, "not done on the goal floor");
	ok(guestHere(r) === null, "still on the floor after the goal");
	ok(
		r.s.log.includes(`${GUESTS.roze.name}「${GUESTS.roze.seen}」`),
		"no seen line",
	);
	ok(!r.s.end, "the run ended");
	r.enterFloor(3, false);
	ok(guestHere(r) === null, "came back on the next floor");
	const { restore } = swapStorage();
	try {
		ok(pendingThanks() === null, "thanks before anything");
		acceptEscort("roze_kinoko");
		noteEscortRun({ id: "roze" });
		ok(pendingThanks() === null, "thanks without reaching the floor");
		noteEscortRun({ id: "roze", done: true });
		ok(pendingThanks() === "roze_kinoko", "no thanks");
		ok(loadEscort().accepted === null, "still accepted");
		doneEscortThanks();
		ok(loadEscort().done.includes("roze_kinoko"), "not done");
		ok(pendingThanks() === null, "thanks twice");
	} finally {
		restore();
	}
});

test("文：同行者の ひとことは ログに 収まる（名前つきで 全角 24字まで）。依頼の 文は 22字×2行・題は 16字", () => {
	for (const [id, g] of Object.entries(GUESTS))
		for (const l of [g.first, g.down, g.seen, ...g.talk])
			ok(width(`${g.name}「${l}」`) <= 24, `${id}: ${l}`);
	for (const e of ESCORTS) {
		ok(width(e.title) <= 16, `${e.id}: title`);
		for (const t of [...e.ask, e.join, e.line, ...e.thanks]) {
			const ls = t.split("\n");
			ok(ls.length <= 2, `${e.id}: ${t}`);
			for (const l of ls) ok(width(l) <= 22, `${e.id}: "${l}"`);
		}
		ok(e.who in GUESTS && e.goal >= 2, `${e.id}: who/goal`);
	}
	for (const t of Object.values(ESCORT_MSG))
		for (const x of Array.isArray(t) ? t : [t])
			for (const l of String(x).split("\n"))
				ok(width(l) <= 22, `ESCORT_MSG: "${l}"`);
});

test("話しかける：様子（キリコの HP・同行者の HP・おなか・帰り道）が 先、ふだんは 回す。窓は 22字×2行", () => {
	for (const [id, t] of Object.entries(GUEST_TALK))
		for (const s of [t.hurt, t.selfHurt, t.hungry, t.home, ...t.chat]) {
			const ls = s.split("\n");
			ok(ls.length <= 2, `${id}: ${s}`);
			for (const l of ls) ok(width(l) <= 22, `${id}: "${l}"`);
		}
	const r = make("guest-talk", "deep", "zero");
	const g = guestHere(r);
	ok(g, "no guest");
	if (!g) return;
	const t = GUEST_TALK.zero;
	ok(guestChat(r, 0) === t.chat[0] && guestChat(r, 1) === t.chat[1], "chat");
	r.s.returning = true;
	ok(guestChat(r, 0) === t.home, "home");
	r.p.hunger = 1;
	ok(guestChat(r, 0) === t.hungry, "hungry");
	g.hp = 1;
	ok(guestChat(r, 0) === t.selfHurt, "self hurt");
	r.p.hp = 1;
	ok(guestChat(r, 0) === t.hurt, "hurt");
	// 話しかけても 状態は かわらない（時間が 進まない・乱数を 引かない）
	const before = serializeRun(r.s);
	guestChat(r, 3);
	ok(serializeRun(r.s) === before, "talking changed the run");
	g.down = true;
	ok(guestChat(r, 0) === null, "a downed guest talked");
});

test("同じ 人が 2人 いない：主人公と 同じ 人は 同行者に ならない。主人公が キリコ で なければ「キリコ」と 呼ばない", () => {
	const self = Run.create("dup", "kinoko", [], "fetch", true, "roze", {
		id: "roze",
		goal: 99,
	});
	ok(self.s.guest === undefined, "ロゼ came with ロゼ");
	const r = Run.create("dup2", "deep", [], "fetch", true, "roze", {
		id: "zero",
		goal: 99,
	});
	ok(guestHere(r), "no ゼロ with ロゼ");
	r.p.hp = 1;
	const hurt = guestChat(r, 0) ?? "";
	ok(
		hurt.includes("ロゼ") && !hurt.includes("キリコ"),
		`called キリコ: ${hurt}`,
	);
	const lines = r.s.log.filter((l) => l.startsWith("ゼロ「"));
	ok(
		lines.length > 0 && lines.every((l) => !l.includes("キリコ")),
		`log called キリコ: ${lines.join(" / ")}`,
	);
	// 潜っている 途中の レス：呼びかけは 主人公に、「キリコの　生まれた　スレ」は そのまま
	ok(
		diveResLine(
			{ at: 13, who: "res", text: "キリコ、井戸に降りたんか" },
			"ロゼ",
		).includes("ロゼ、井戸"),
		"the res still calls キリコ",
	);
	ok(
		diveResLine(
			{ at: 95, who: null, text: "底に、キリコの生まれたスレがある。" },
			"ロゼ",
		).includes("キリコの生まれた"),
		"rewrote キリコ's own thread",
	);
});

export const runGuestTests = async (): Promise<TestResult[]> => {
	const out: TestResult[] = [];
	for (const c of CASES) {
		try {
			await c.run();
			out.push({ id: "guest", name: c.name, ok: true });
		} catch (e) {
			out.push({
				id: "guest",
				name: c.name,
				ok: false,
				reason: e instanceof Fail ? e.message : String(e),
			});
		}
	}
	return out;
};

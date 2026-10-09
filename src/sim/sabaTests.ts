// ホシュクラ（保守村の 南西の 島。data/village/saba.ts・data/saba.ts・data/sabaMine.ts・ui/saba.ts）の 試験（pnpm test）。
// 置き場所・絵・文の 幅・命名投票・お知らせ・ブラマイの 決まりと 釣りあい・村での 流れ（板は setMineHook で 差しかえ）・
// 共有の 振り分け（ui/facilities.ts・ui/villageEvents.ts の 1行が 落ちたら ここで 気づく）。

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { TOWN_STAGES } from "../core/town";
import { CAST } from "../data/cast";
import { MOBS } from "../data/mobs";
import {
	EVENT_HOUR,
	eventOf,
	freshSaba,
	isleMap,
	isNight,
	noticeOf,
	onIsle,
	parseSaba,
	pendingResult,
	takumiCell,
	takumiLeave,
	tankLine,
	townName,
	voteResult,
} from "../data/saba";
import {
	CELL,
	cellAt,
	gateAct,
	gateSpill,
	lit,
	MINE,
	MINE_INPUT,
	type MineAct,
	type MineState,
	mineAct,
	mineFrom,
	mineGate,
	mineNew,
	type Rand,
	seeded,
	seenAt,
} from "../data/sabaMine";
import { SABA_CELLS, SABA_SIZE, TAKUMI_WALK } from "../data/sabaSheet";
import { SABA_TEXT as X } from "../data/sabaText";
import { PERSONAS } from "../data/village/crowd";
import {
	FACILITIES,
	facilitiesAt,
	facilityById,
	facilityDoor,
	facilityOutside,
	outdoorId,
} from "../data/village/facilities";
import {
	asideSpot,
	lineupSpots,
	spotsAround,
	VILLAGE_EXITS,
	type VillageView,
	villagePalette,
	villageRows,
} from "../data/village/map";
import { ISLE_ROWS } from "../data/village/saba";
import type { Story, VState } from "../engine/defs";
import type { Dir } from "../engine/types";
import type { Ctx } from "../ui/ctx";
import { buildFacility } from "../ui/facilities";
import {
	ASA,
	forgetSabaMemo,
	loadSaba,
	NAG_BASE,
	PIG_ID,
	sabaEvents,
	sabaPlay,
	setSabaNow,
	TAKUMI_ID,
	TAKUMI_SEEN,
} from "../ui/saba";
import { setMineHook } from "../ui/sabaMine";
import { buildVillage } from "../ui/villageEvents";
import type { TestResult } from "./monsterTests";

class Fail extends Error {}
const ok = (cond: unknown, why: string): void => {
	if (!cond) throw new Fail(why);
};
const CASES: { name: string; run: () => void | Promise<void> }[] = [];
const test = (name: string, run: () => void | Promise<void>) =>
	CASES.push({ name, run });

const view = (stage: number): VillageView => ({
	stage,
	unlocked: ["shallow"],
	cleared: [],
});
const SABA = FACILITIES.filter((f) => f.id.startsWith("saba"));
const SABA_IDS = [
	"saba2",
	"saba3",
	"saba4",
	"saba5",
	"saba6",
	"saba7",
	"saba_apart",
];
const width = (s: string): number =>
	[...s].reduce((w, ch) => w + (/[\x20-\x7e｡-ﾟ]/.test(ch) ? 0.5 : 1), 0);
const isle = (x: number, y: number): boolean => x <= 19 && y >= 41 && y <= 48;

// ───────────────── 置き場所 ─────────────────

test("ホシュクラ：島は 段2 から 段ごとに 1つ（saba2〜saba7）、アパートは 段4 から・市役所より 後ろに まとめて 並ぶ", () => {
	for (let stage = 0; stage < TOWN_STAGES; stage++) {
		const ids = facilitiesAt(stage)
			.map((f) => f.id)
			.filter((id) => id.startsWith("saba"));
		const want = [
			...(stage >= 2 ? [`saba${stage}`] : []),
			...(stage >= 4 ? ["saba_apart"] : []),
		];
		ok(
			JSON.stringify(ids) === JSON.stringify(want),
			`stage ${stage}: ${ids.join(",")}`,
		);
	}
	// もとから ある 施設の 後ろ（字の 割りふりが ほかの 施設を ずらさない）。後ろに ほかの 包みが 足すのは かまわない
	const ids = FACILITIES.map((f) => f.id);
	const i = ids.indexOf("saba2");
	ok(i > ids.indexOf("cityhall"), "saba2 is before cityhall");
	ok(
		JSON.stringify(ids.slice(i, i + SABA_IDS.length)) ===
			JSON.stringify(SABA_IDS),
		`saba facilities are not together: ${ids.slice(i, i + SABA_IDS.length).join(",")}`,
	);
	ok(SABA.length === SABA_IDS.length, `${SABA.length} saba facilities`);
});

test("ホシュクラ：島の 行は 20×8（x0〜19・y41〜48）・扉は 豆腐ハウスに 1つ", () => {
	for (const [st, rows] of Object.entries(ISLE_ROWS)) {
		ok(rows.length === 8, `stage ${st}: ${rows.length} rows`);
		for (const r of rows) ok([...r].length === 20, `stage ${st}: "${r}"`);
		ok(rows.join("").split("D").length === 2, `stage ${st}: door count`);
	}
	for (const f of SABA) {
		const d = facilityDoor(f);
		ok(d, `${f.id}: no door`);
		const o = facilityOutside(f);
		ok(
			o.y === 44,
			`${f.id}: comes out on (${o.x},${o.y}), not on the island street`,
		);
	}
});

test("ホシュクラ：島の 下（y48〜51）と 釣り場の 西の 海（y39〜40）に 歩ける マスを 作らない・南の 口で 仲間が 並ぶ／呼ばれて 立つ 所は 島に かからない", () => {
	const south = VILLAGE_EXITS.find((e) => e.side === "s");
	ok(south, "no south exit");
	for (let stage = 0; stage < TOWN_STAGES; stage++) {
		const v = view(stage);
		const rows = villageRows(v).map((r) => [...r]);
		const pal = villagePalette(v);
		for (let y = 48; y <= 51; y++)
			for (let x = 0; x <= 18; x++)
				ok(
					!pal[rows[y][x]]?.passable,
					`stage ${stage}: (${x},${y}) is walkable under the island`,
				);
		for (const [y, x1] of [
			[39, 14],
			[40, 18],
		] as const)
			for (let x = 0; x <= x1; x++)
				ok(rows[y][x] === "う", `stage ${stage}: (${x},${y}) is not open sea`);
		if (south) {
			for (const [x] of lineupSpots(v, 12, south))
				ok(x >= 19, `stage ${stage}: a friend lines up on the island (${x})`);
			const inward: [number, number] = [south.cell[0], south.cell[1] - 1];
			for (const [x, y] of spotsAround(v, 20, inward))
				ok(
					!isle(x, y),
					`stage ${stage}: a called friend stands on (${x},${y})`,
				);
			const a = asideSpot(v, inward, south.cell);
			ok(!a || !isle(a[0], a[1]), `stage ${stage}: aside on the island ${a}`);
		}
		// 桟橋は いつも 歩ける
		for (let y = 36; y <= 48; y++)
			ok(
				pal[rows[y][20]]?.passable,
				`stage ${stage}: the pier (20,${y}) is cut`,
			);
	}
});

test("ホシュクラ：豚レース場は 柵で 閉じ、柵ごしに 豚に 話せる", () => {
	for (let stage = 3; stage < TOWN_STAGES; stage++) {
		const v = view(stage);
		const rows = villageRows(v).map((r) => [...r]);
		const pal = villagePalette(v);
		const lane = (x: number, y: number) => y === 47 && x >= 12 && x <= 16;
		for (let x = 12; x <= 16; x++) {
			ok(
				pal[rows[47][x]]?.passable,
				`stage ${stage}: the lane (${x},47) is not walkable for the pig`,
			);
			ok(
				pal[rows[46][x]]?.counter,
				`stage ${stage}: the fence (${x},46) is not a counter`,
			);
			for (const [dx, dy] of [
				[1, 0],
				[-1, 0],
				[0, 1],
				[0, -1],
			]) {
				const nx = x + dx;
				const ny = 47 + dy;
				if (lane(nx, ny)) continue;
				ok(
					!pal[rows[ny]?.[nx] ?? ""]?.passable,
					`stage ${stage}: the pig can leave through (${nx},${ny})`,
				);
			}
		}
		const pig = sabaEvents(v).find((e) => e.id === PIG_ID);
		ok(pig?.wander && pig.x === 14 && pig.y === 47, `stage ${stage}: pig`);
	}
	ok(!sabaEvents(view(2)).some((e) => e.id === PIG_ID), "a pig at stage 2");
	ok(sabaEvents(view(1)).length === 0, "saba events at stage 1");
});

test("ホシュクラ：夜の 匠は ふだん いない・出る マスは キリコの となりの 島の 通れる 空いた マス", () => {
	const flags: VState = { x: 0, y: 0, dir: "down", flags: {} };
	const tk = sabaEvents(view(3)).find((e) => e.id === TAKUMI_ID);
	ok(tk?.when && !tk.when(flags), "the takumi is there without the flag");
	ok(
		tk?.when?.({ ...flags, flags: { "saba:takumi": true } }),
		"the takumi does not show with the flag",
	);
	for (let stage = 2; stage < TOWN_STAGES; stage++) {
		const m = isleMap(view(stage));
		const { rows, pal, taken } = m;
		let cells = 0;
		let found = 0;
		let leaves = 0;
		for (let y = 41; y <= 47; y++)
			for (let x = 0; x <= 19; x++) {
				if (
					!onIsle(x, y) ||
					!pal[rows[y][x]]?.passable ||
					taken.has(`${x},${y}`)
				)
					continue;
				for (const dir of ["up", "right", "down", "left"] as Dir[]) {
					cells++;
					const c = takumiCell(m, x, y, dir);
					if (!c) continue;
					found++;
					const [tx, ty] = c;
					ok(
						Math.abs(tx - x) + Math.abs(ty - y) === 1,
						`stage ${stage}: (${tx},${ty}) is not beside (${x},${y})`,
					);
					ok(
						onIsle(tx, ty) &&
							pal[rows[ty][tx]]?.passable &&
							!taken.has(`${tx},${ty}`),
						`stage ${stage}: (${tx},${ty})`,
					);
					const leave = takumiLeave(m, x, y, tx, ty);
					ok(
						/^(u|d|l|r){0,2}$/.test(leave),
						`stage ${stage}: leave "${leave}"`,
					);
					if (leave) leaves++;
				}
			}
		ok(found >= cells * 0.9, `stage ${stage}: only ${found}/${cells} spots`);
		ok(
			leaves >= found * 0.9,
			`stage ${stage}: the takumi cannot walk away from ${found - leaves} spots`,
		);
	}
});

// ───────────────── 絵 ─────────────────

const pngSize = (file: string): [number, number] => {
	const b = readFileSync(join(process.cwd(), file));
	return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

test("ホシュクラ：絵は まとめた saba.png の 16px の 格子の 中・匠の 歩行グラは 32×64・人の 絵は ほかの 人と かぶらない", () => {
	const [w, h] = pngSize("public/sprites/saba.png");
	ok(w === SABA_SIZE[0] && h === SABA_SIZE[1], `saba.png is ${w}x${h}`);
	const [tw, th] = pngSize("public/sprites/saba_takumi.png");
	ok(tw === 32 && th === 64, `saba_takumi.png is ${tw}x${th}`);
	for (const [n, [c, r]] of Object.entries(SABA_CELLS))
		ok(c < 16 && (r + 1) * 16 <= h, `${n} is outside`);
	const refs: string[] = [];
	for (const f of SABA) {
		if (f.look.kind === "grid")
			for (const l of Object.values(f.look.keys)) refs.push(...l);
		for (const t of f.outdoor ?? [])
			if (t.sprite) ok(t.sprite.startsWith("sa:"), `${t.id}: ${t.sprite}`);
	}
	for (const ref of refs) {
		ok(ref.startsWith("pub:sprites/saba.png#"), `draws ${ref}`);
		const [x, y, rw, rh] = ref.split("#")[1].split(",").map(Number);
		ok(
			x % 16 === 0 && y % 16 === 0 && x + rw <= w && y + rh <= h,
			`${ref} is off the sheet`,
		);
	}
	// 島の 人・豚の 歩行グラは 通行人・住人・仲間と ちがう（見分けが つく）
	const others = new Set([
		...PERSONAS.flatMap((p) => p.sprites),
		...Object.values(MOBS).map((m) => m.sprite),
		...Object.values(CAST).map((c) => c.walk),
	]);
	const ours = [
		...SABA.flatMap((f) =>
			(f.outdoor ?? []).flatMap((t) => (t.sprite ? [t.sprite] : [])),
		),
		"sa:7Cqdmq",
		TAKUMI_WALK,
	];
	for (const s of ours) ok(!others.has(s), `${s} is used by someone else`);
});

// ───────────────── 文 ─────────────────

const BANNED = [
	/落ち/,
	/マイクラ|マインクラフト|Minecraft|Mojang/i,
	/クリーパー|エンダーマン|スティーブ/,
	/統合版|Java|JAVA|Bedrock/,
	/保守/,
	/黄色|きいろ|山吹/,
	/うんち|うんこ/,
	/114514|1919|810/,
	/真理教|サティアン|尊師|布施|お参り|供物/,
	/おんＪ/,
	/\p{Extended_Pictographic}/u,
	/️|‍/,
];
const words = (path: string, s: string): void => {
	for (const re of BANNED) ok(!re.test(s), `${path}: "${s}" has ${re}`);
};
const fits = (path: string, s: string): void => {
	const lines = s.split("\n");
	ok(lines.length <= 2, `${path}: ${lines.length} lines`);
	for (const l of lines)
		ok(width(l) <= 22, `${path}: "${l}" is ${width(l)} wide`);
	words(path, s);
};
const one = (path: string, s: string, max: number): void => {
	ok(
		!s.includes("\n") && width(s) <= max,
		`${path}: "${s}" is ${width(s)} > ${max}`,
	);
	words(path, s);
};
const LONG = {
	event: X.events[5],
	n: 999,
	name: "ウーパー跡地",
	other: "ホシュクラ村",
	item: X.chestItems[5],
	tail: X.mineTail0,
};
const filled = (s: string): string =>
	s.replace(/\{(\w+)\}/g, (_, k: string) =>
		String(LONG[k as keyof typeof LONG] ?? ""),
	);

test("ホシュクラ：文は 窓に おさまる（22字×2行）・板の 一言は 1行・選ぶ 字は 9字まで・名前の 候補は 7字まで・使わない 語が ない", () => {
	const {
		board,
		cands,
		mineMenu,
		bedMenu,
		room102Menu,
		chestItems,
		names,
		voteDefault,
		voteStop,
		events,
		notices,
		...rest
	} = X;
	const walk = (path: string, v: unknown): void => {
		if (typeof v === "string") fits(path, filled(v));
		else if (Array.isArray(v))
			for (const [i, x] of v.entries()) walk(`${path}[${i}]`, x);
		else if (v && typeof v === "object")
			for (const [k, x] of Object.entries(v)) walk(`${path}.${k}`, x);
	};
	walk("SABA_TEXT", rest);
	for (const n of notices) fits("notices", n.text);
	for (const e of events) {
		one("events", e, 22);
		fits("saturday", X.saturday.replace("{event}", e));
		fits("saturdayNight", X.saturdayNight.replace("{event}", e));
	}
	for (const [k, s] of Object.entries(board)) one(`board.${k}`, filled(s), 22);
	for (const list of Object.values(cands))
		for (const c of list) {
			one("cands", c, 7);
			fits("townSign", X.townSign.replace("{name}", c));
		}
	for (const c of [...mineMenu, ...bedMenu, ...room102Menu, voteStop])
		one("menu", c, 9);
	for (const c of chestItems) one("chestItems", c, 13);
	for (const n of Object.values(names)) one("names", n, 11);
	one("voteDefault", voteDefault, 7);
	// 島の 人は 話す たびに 全部 読む ので 2窓まで（このあと ui/saba.ts が 1窓 足す ことが ある）
	for (const f of SABA)
		for (const t of f.outdoor ?? [])
			if (t.name)
				ok(t.lines.length <= 2, `${f.id}.${t.id}: ${t.lines.length} windows`);
});

// ───────────────── 決まり（命名投票・お知らせ・水槽・夜） ─────────────────

test("ホシュクラ：命名投票は キリコの 1票で 0 か 1 に 決まり、ほかは 決選で 0（ネタ）", () => {
	const want: [number, number, boolean][] = [
		[-1, 0, true],
		[0, 0, false],
		[1, 1, false],
		[2, 0, true],
		[3, 0, true],
	];
	for (const [pick, win, runoff] of want) {
		const r = voteResult(pick);
		ok(
			r.win === win && r.runoff === runoff,
			`pick ${pick}: ${JSON.stringify(r)}`,
		);
		ok(r.other !== r.win, `pick ${pick}: other`);
	}
	const s = freshSaba();
	ok(townName(s, 2, 10) === X.voteDefault, "stage 2 name");
	s.votes["3"] = { pick: 1, at: 10, told: false };
	ok(townName(s, 3, 10) === X.voteDefault, "decided in the same return");
	ok(pendingResult(s, 3, 10) === null, "pending in the same return");
	ok(townName(s, 3, 11) === X.cands[3][1], "not decided next return");
	ok(pendingResult(s, 3, 11) === 3, "no pending next return");
	// 段4 で 入れなくても 段5 に なれば 決選で 決まる
	ok(townName(s, 5, 12) === X.cands[4][0], `stage 5: ${townName(s, 5, 12)}`);
	ok(pendingResult(s, 5, 12) === 4, "stage 4 result pending at stage 5");
});

test("ホシュクラ：鯖缶の お知らせ（土曜 21時〜 → 夜 → 朝やで → 土曜 → 日曜 → 帰りごと）・水槽・夜の 時刻", () => {
	const wd = { m: 10, d: 7, w: 3 };
	const sat = { m: 10, d: 10, w: 6 };
	ok(
		noticeOf({ n: 1, stage: 3, day: wd, hour: 22, asa: false }) === X.night,
		"night",
	);
	ok(
		noticeOf({ n: 1, stage: 3, day: wd, hour: 2, asa: true }) === X.morning,
		"morning",
	);
	ok(
		noticeOf({ n: 1, stage: 3, day: sat, hour: 12, asa: false }) ===
			X.saturday.replace("{event}", eventOf(sat)),
		"saturday",
	);
	for (const hour of [EVENT_HOUR, 22, 23])
		ok(
			noticeOf({ n: 1, stage: 3, day: sat, hour, asa: true }) ===
				X.saturdayNight.replace("{event}", eventOf(sat)),
			`saturday ${hour}h`,
		);
	ok(
		noticeOf({ n: 1, stage: 3, day: sat, hour: 20, asa: false }) === X.night,
		"saturday 20h",
	);
	ok(
		eventOf({ m: 10, d: 10, w: 6 }) !== eventOf({ m: 10, d: 17, w: 6 }),
		"the event is the same two weeks",
	);
	ok(
		noticeOf({ n: 1, stage: 3, day: { ...wd, w: 0 }, hour: 12, asa: false }) ===
			X.sunday,
		"sunday",
	);
	const seen = new Set<string>();
	for (let n = 1; n <= X.notices.length; n++)
		seen.add(noticeOf({ n, stage: 3, day: wd, hour: 12, asa: false }));
	ok(seen.size === X.notices.length, `${seen.size} notices in a cycle`);
	for (let n = 1; n <= 20; n++)
		ok(
			noticeOf({ n, stage: 2, day: wd, hour: 12, asa: false }) !==
				X.notices[3].text,
			"the pig notice before the pig",
		);
	ok(
		tankLine(1) === null &&
			tankLine(2) === X.tankNote &&
			tankLine(3) === X.tankClean &&
			tankLine(4) === X.tankGone &&
			tankLine(5) === null,
		"tank",
	);
	for (let h = 0; h < 24; h++)
		ok(isNight(h) === (h >= 20 || h < 5), `hour ${h}`);
});

test("ホシュクラ：記録を 読む（こわれた 値は はじめの 値・投票は 段3〜7 だけ）", () => {
	ok(JSON.stringify(parseSaba(null)) === JSON.stringify(freshSaba()), "null");
	ok(
		JSON.stringify(parseSaba({ v: 2 })) === JSON.stringify(freshSaba()),
		"version",
	);
	const s = parseSaba({
		v: 1,
		ret: 5,
		n: -3,
		nag: 2.5,
		apart: "yes",
		mine: { best: 4, runs: 2, total: 7 },
		votes: {
			"3": { pick: 1, at: 4 },
			"9": { pick: 0, at: 1 },
			"4": { pick: 7, at: 1 },
		},
	});
	ok(
		s.ret === 5 && s.n === 0 && s.nag === 0 && s.apart === false,
		JSON.stringify(s),
	);
	ok(s.mine.best === 4 && s.mine.runs === 2 && s.mine.total === 7, "mine");
	ok(
		JSON.stringify(Object.keys(s.votes)) === '["3"]' &&
			s.votes["3"].told === false,
		JSON.stringify(s.votes),
	);
});

// ───────────────── ブラマイ ─────────────────

const play = (st: MineState, acts: MineAct[]) =>
	acts.map((a) => mineAct(st, a));

test("ブラマイ：地下の 形（岩盤・安全な 縦穴・ダイヤ・溶岩の 数）", () => {
	let dias = 0;
	let lava5 = 0;
	for (let seed = 1; seed <= 300; seed++) {
		const st = mineNew(seeded(seed));
		for (let x = 0; x < MINE.W; x++)
			ok(cellAt(st, x, MINE.H - 1) === CELL.BEDROCK, `seed ${seed}: bedrock`);
		for (let y = 0; y <= 2; y++)
			ok(cellAt(st, 1, y) === CELL.AIR, `seed ${seed}: shaft`);
		for (let y = 0; y < MINE.H - 1; y++)
			for (let x = 0; x <= 3; x++)
				if (!(x === 1 && y <= 2))
					ok(
						cellAt(st, x, y) === CELL.STONE,
						`seed ${seed}: (${x},${y}) near the shaft`,
					);
		let d = 0;
		for (let y = 0; y < MINE.H; y++)
			for (let x = 0; x < MINE.W; x++) if (cellAt(st, x, y) === CELL.DIA) d++;
		for (let x = 0; x < MINE.W; x++)
			if (cellAt(st, x, 5) === CELL.LAVA) lava5++;
		ok(d >= 1 && d <= 14, `seed ${seed}: ${d} diamonds`);
		dias += d;
		ok(
			st.x === 1 &&
				st.y === 2 &&
				st.pick === MINE.PICK &&
				st.torches === MINE.TORCHES &&
				!st.spill,
			"start",
		);
	}
	ok(dias / 300 >= 4.5 && dias / 300 <= 8, `avg ${dias / 300} diamonds`);
	// 段5 にも 溶岩が ある（横穴を 見ずに 掘ると あふれる）
	ok(lava5 / 300 >= 2 && lava5 / 300 <= 5, `row 5 lava ${lava5 / 300}`);
});

test("ブラマイ：石は 1回・鉱石は 2回で 掘れて 進む・石炭で 松明・岩盤と 溶岩は 進めない", () => {
	// キリコは 縦穴の (1,2)。右に 空気・石炭・ダイヤ
	const st = mineFrom(["", "", "#..cd"]);
	const r = play(st, ["right"]);
	ok(r[0].includes("move") && st.x === 2, `move ${JSON.stringify(r)}`);
	const c1 = mineAct(st, "right");
	ok(
		c1.includes("hit") && st.x === 2 && st.pick === MINE.PICK,
		`coal 1st ${c1}`,
	);
	const c2 = mineAct(st, "right");
	ok(
		c2.includes("coal") &&
			st.x === 3 &&
			st.torches === MINE.TORCHES + MINE.COAL_TORCH &&
			st.pick === MINE.PICK - 1,
		`coal ${c2}`,
	);
	play(st, ["right", "right"]);
	ok(st.dia === 1 && st.x === 4, `diamond ${st.dia} at ${st.x}`);
	const s2 = mineFrom(["", "", "", "", "", "", ""]);
	s2.x = 5;
	s2.y = 6;
	ok(mineAct(s2, "down").includes("bedrock") && s2.y === 6, "bedrock");
	const s3 = mineFrom(["", "", "", "", "", "", "L"]);
	s3.x = 0;
	s3.y = 5;
	s3.g[5 * MINE.W + 0] = CELL.AIR;
	ok(
		mineAct(s3, "down").includes("lavaSeen") &&
			s3.y === 5 &&
			s3.pick === MINE.PICK,
		"lava blocks",
	);
});

test("ブラマイ：直下掘りで 下が 溶岩なら おしまい（ダイヤも 0）・洞窟なら 床まで 落ちる・松明は 2マス 下も 照らす", () => {
	const lava = mineFrom(["", "", "", "", "", "", "#####L"]);
	lava.x = 5;
	lava.y = 4;
	lava.g[4 * MINE.W + 5] = CELL.AIR;
	lava.dia = 3;
	ok(!seenAt(lava, 5, 6), "the lava is seen before the torch");
	ok(
		mineAct(lava, "torch").includes("torch") && seenAt(lava, 5, 6),
		"the torch does not light two below",
	);
	const ev = mineAct(lava, "down");
	ok(
		ev.includes("lavaDeath") && lava.over === "lava" && lava.dia === 0,
		`lava ${ev}`,
	);
	const cave = mineFrom(["", "", "", "", "", "........."]);
	cave.x = 5;
	cave.y = 3;
	cave.g[3 * MINE.W + 5] = CELL.AIR;
	const f = mineAct(cave, "down");
	ok(
		f.includes("fall") && cave.y === 5 && !cave.over,
		`fall ${f} to ${cave.y}`,
	);
});

test("ブラマイ：見えて いない 溶岩の となりを 掘りぬくと あふれる・次の 1手で 出れば ふさがる、出なければ のまれる（ダイヤも 0）・見えて いれば あふれない", () => {
	// (10,2) の 石の 先 (11,2) に 溶岩。キリコは (9,2)
	const mk = (): MineState => {
		const st = mineFrom(["", "", "#.........#L"]);
		st.x = 9;
		st.y = 2;
		st.dia = 2;
		return st;
	};
	const a = mk();
	ok(!seenAt(a, 11, 2), "the lava is seen");
	const e1 = mineAct(a, "right");
	ok(
		e1.includes("spill") && a.spill?.x === 10 && a.x === 10,
		`spill ${JSON.stringify(e1)}`,
	);
	// 見ずに 押しつづける（溶岩へ）→ のまれる
	const e2 = mineAct(a, "right");
	ok(
		e2.includes("lavaDeath") && a.over === "lava" && a.dia === 0,
		`hold ${JSON.stringify(e2)} ${a.over}`,
	);
	// 1歩 もどる → そこは 溶岩で ふさがる
	const b = mk();
	mineAct(b, "right");
	const e3 = mineAct(b, "left");
	ok(
		e3.includes("spillSafe") &&
			!b.over &&
			b.x === 9 &&
			cellAt(b, 10, 2) === CELL.LAVA &&
			b.dia === 2,
		`step back ${JSON.stringify(e3)}`,
	);
	ok(mineAct(b, "right").includes("lavaSeen") && b.x === 9, "walk into it");
	// 松明を 置いても 出て いない
	const c = mk();
	mineAct(c, "right");
	ok(mineAct(c, "torch").includes("lavaDeath") && c.over === "lava", "torch");
	// 先に 照らして あれば あふれない
	const lit2 = mk();
	mineAct(lit2, "torch");
	ok(seenAt(lit2, 11, 2), "the torch does not show the lava");
	const e4 = mineAct(lit2, "right");
	ok(!e4.includes("spill") && !lit2.spill, `lit spill ${JSON.stringify(e4)}`);
});

test("ブラマイ：板の 入力（長押しは 140ms ごと・下と A は くりかえさない・あふれたら 少し 止まり、長押しは 押しなおすまで 止める・やめるは いつでも）", () => {
	const { REPEAT_MS, SPILL_MS } = MINE_INPUT;
	const g = mineGate();
	ok(gateAct(g, "right", 1000, false), "press");
	ok(!gateAct(g, "right", 1000 + REPEAT_MS - 1, true), "repeat too soon");
	ok(gateAct(g, "right", 1000 + REPEAT_MS, true), "repeat");
	ok(!gateAct(g, "down", 2000, true), "down repeats");
	ok(gateAct(g, "down", 2000, false), "down press");
	ok(!gateAct(g, "torch", 3000, true) && gateAct(g, "torch", 3000, false), "A");
	gateSpill(g, 4000);
	ok(!gateAct(g, "left", 4000 + SPILL_MS - 1, false), "press while spilling");
	ok(!gateAct(g, "torch", 4000 + SPILL_MS - 1, false), "A while spilling");
	ok(gateAct(g, "quit", 4001, false), "quit while spilling");
	ok(!gateAct(g, "right", 5000, true), "the held key after the spill");
	ok(gateAct(g, "left", 5000, false), "a new press after the spill");
	ok(gateAct(g, "left", 5000 + REPEAT_MS, true), "its repeat");
	// 長押しで 段5 を 掘る 人（33ms ごとの くりかえし・260ms で 気づいて 離し、← を 押す）：のまれない
	const st = mineFrom(["", "", "", "", "", "#....##L"]);
	st.x = 4;
	st.y = 5;
	st.dia = 2;
	const h = mineGate();
	let spillAt = -1;
	const step = (act: MineAct, t: number, repeat: boolean): void => {
		if (!gateAct(h, act, t, repeat)) return;
		if (mineAct(st, act).includes("spill")) {
			gateSpill(h, t);
			spillAt = t;
		}
	};
	step("right", 0, false);
	for (let t = 500; t < 3000 && !st.over; t += 33) {
		if (spillAt >= 0 && t - spillAt >= 260) break;
		step("right", t, true);
	}
	ok(spillAt >= 0 && !st.over && st.spill?.x === 6, `held: ${st.over}`);
	ok(gateAct(h, "left", spillAt + SPILL_MS, false), "step back");
	const back = mineAct(st, "left");
	ok(
		back.includes("spillSafe") && !st.over && st.dia === 2,
		`back ${JSON.stringify(back)}`,
	);
});

test("ブラマイ：暗い ところを 歩くと うしろに 匠・2歩 はなれれば 止む・とどまれば ﾄﾞｶｰﾝ・つるはしは 48回", () => {
	const row = `.${".".repeat(MINE.W - 1)}`;
	const mk = (): MineState => {
		const st = mineFrom(["", "", "", "", row]);
		st.x = 10;
		st.y = 4;
		st.torchList.length = 0;
		st.torch.fill(0);
		return st;
	};
	const st = mk();
	const r = play(
		st,
		Array.from({ length: MINE.DARK_LIMIT }, () => "right" as const),
	);
	ok(
		r[MINE.DARK_LIMIT - 1].includes("takumiSpawn") && st.takumi?.x === st.x - 1,
		`spawn ${JSON.stringify(st.takumi)}`,
	);
	const g = play(st, ["right", "right"]);
	ok(
		g[1].includes("takumiGone") && !st.takumi && !st.over,
		`gone ${JSON.stringify(g)}`,
	);
	const b = mk();
	play(
		b,
		Array.from({ length: MINE.DARK_LIMIT }, () => "right" as const),
	);
	const boom = play(b, ["left", "right", "left"]);
	ok(
		boom.flat().includes("takumiBoom") && b.over === "takumi",
		`boom ${JSON.stringify(boom)} ${b.over}`,
	);
	// つるはし（のこり 9 → すり減る → 0 で こわれる）
	const p = mineFrom([]);
	p.pick = 9;
	ok(mineAct(p, "right").includes("worn") && p.pick === 8, `worn ${p.pick}`);
	play(
		p,
		Array.from({ length: 8 }, () => "right" as const),
	);
	ok(p.over === "broke" && p.pick === 0, `pick ${p.pick} ${p.over}`);
});

const at = (st: MineState, x: number, y: number) => st.g[y * MINE.W + x];
const inside = (x: number, y: number) =>
	x >= 0 && x < MINE.W && y >= 0 && y < MINE.H;
const BACK: Record<string, MineAct> = {
	left: "right",
	right: "left",
	up: "down",
	down: "up",
};

/**
 * 釣りあいを 見る 掘り手（careful：松明で 足もとを 見てから 掘り下げ、段4 で 横穴と 枝。reckless：直下掘りで 底まで）。
 * react：溶岩が あふれたら 1歩 もどる 割合。見える ものだけで 決める（直下掘りの 下だけは 見える 前提の 確かめ）。
 */
const bot = (
	st: MineState,
	rand: Rand,
	p: {
		torchP: number;
		checkP: number;
		fleeP: number;
		row: number;
		startX?: number;
		react?: number;
	},
) => {
	const plan: MineAct[] = [];
	let target = p.startX ?? 2;
	const safeDown = (): boolean => {
		if (
			!inside(st.x, st.y + 1) ||
			at(st, st.x, st.y + 1) === CELL.LAVA ||
			at(st, st.x, st.y + 1) === CELL.BEDROCK
		)
			return false;
		if (!inside(st.x, st.y + 2)) return true;
		return (
			seenAt(st, st.x, st.y + 2) &&
			at(st, st.x, st.y + 2) !== CELL.LAVA &&
			at(st, st.x, st.y + 2) !== CELL.AIR
		);
	};
	const litHere = () =>
		st.torchList.some(
			([tx, ty]) =>
				Math.abs(tx - st.x) <= MINE.LIGHT && Math.abs(ty - st.y) <= MINE.LIGHT,
		);
	return (): MineAct => {
		if (st.spill && rand() < (p.react ?? 0)) {
			plan.length = 0;
			return BACK[st.dir];
		}
		if (st.takumi) {
			if (rand() < p.fleeP) {
				const away: MineAct =
					st.takumi.x > st.x
						? "left"
						: st.takumi.x < st.x
							? "right"
							: rand() < 0.5
								? "left"
								: "right";
				const nx = st.x + (away === "left" ? -1 : 1);
				if (
					inside(nx, st.y) &&
					at(st, nx, st.y) !== CELL.LAVA &&
					at(st, nx, st.y) !== CELL.BEDROCK
				)
					return away;
				return st.y > 0 ? "up" : "right";
			}
			plan.length = 0;
		}
		if (!litHere() && st.dark >= 3 && st.torches > 0 && rand() < p.torchP)
			return "torch";
		if (plan.length) {
			const a = plan[0];
			if (
				a === "down" &&
				inside(st.x, st.y + 1) &&
				at(st, st.x, st.y + 1) !== CELL.AIR &&
				rand() < p.checkP &&
				!safeDown()
			)
				plan.length = 0;
			else return plan.shift() ?? "right";
		}
		if (st.y < p.row) {
			if (st.x < target) return "right";
			if (rand() < p.checkP) {
				if (
					inside(st.x, st.y + 2) &&
					!seenAt(st, st.x, st.y + 2) &&
					st.torches > 0 &&
					!st.torch[st.y * MINE.W + st.x]
				)
					return "torch";
				if (!safeDown()) {
					target = st.x + 1;
					return "right";
				}
			}
			if (at(st, st.x, st.y + 1) === CELL.LAVA) {
				target = st.x + 1;
				return "right";
			}
			return "down";
		}
		for (const d of ["up", "left", "right", "down"] as const) {
			const nx = st.x + (d === "left" ? -1 : d === "right" ? 1 : 0);
			const ny = st.y + (d === "up" ? -1 : d === "down" ? 1 : 0);
			if (!inside(nx, ny) || !seenAt(st, nx, ny) || at(st, nx, ny) !== CELL.DIA)
				continue;
			if (d === "down" && rand() < p.checkP && !safeDown()) continue;
			return d;
		}
		if (
			st.x % 3 === 0 &&
			st.y === p.row &&
			inside(st.x, st.y - 1) &&
			at(st, st.x, st.y - 1) !== CELL.AIR
		) {
			plan.push("up", "up", "down", "down");
			return plan.shift() ?? "up";
		}
		if (st.x + 1 >= MINE.W) return "quit";
		const r = at(st, st.x + 1, st.y);
		if (r === CELL.LAVA || r === CELL.BEDROCK)
			return st.y > 1 && at(st, st.x, st.y - 1) !== CELL.LAVA ? "up" : "quit";
		return "right";
	};
};

/**
 * いちばん 強い 掘り方（content 審査の 段5 横穴）：縦穴で 段5 まで 降り、右へ 押しつづける。見えた ダイヤは 上下も 取る。
 * 暗さ 6 で 松明。見えて いる 溶岩・岩盤の 前では 1段 上へ。react：あふれたのに 気づいて 1歩 もどる 割合（0 = 押しっぱなし）。
 */
const row5Bot = (st: MineState, rand: Rand, react: number) => {
	const plan: MineAct[] = ["down", "down", "down"];
	let row = 5;
	return (): MineAct => {
		if (st.spill) {
			if (rand() < react) {
				plan.length = 0;
				row = Math.max(3, st.y - 1);
				return BACK[st.dir];
			}
			return st.dir;
		}
		if (plan.length) return plan.shift() ?? "right";
		if (st.takumi) {
			const away: MineAct = st.takumi.x > st.x ? "left" : "right";
			const nx = st.x + (away === "left" ? -1 : 1);
			if (inside(nx, st.y) && at(st, nx, st.y) === CELL.AIR) return away;
			return "right";
		}
		if (st.dark >= 6 && st.torches > 0 && !lit(st, st.x, st.y)) return "torch";
		const solid = (x: number, y: number) =>
			y >= MINE.H - 1 ||
			(seenAt(st, x, y) &&
				at(st, x, y) !== CELL.AIR &&
				at(st, x, y) !== CELL.LAVA);
		if (
			st.y > 0 &&
			seenAt(st, st.x, st.y - 1) &&
			at(st, st.x, st.y - 1) === CELL.DIA
		) {
			plan.push("up", "down");
			return "up";
		}
		if (
			st.y + 1 <= 6 &&
			seenAt(st, st.x, st.y + 1) &&
			at(st, st.x, st.y + 1) === CELL.DIA &&
			solid(st.x, st.y + 2)
		) {
			plan.push("down", "up");
			return "down";
		}
		if (st.x + 1 >= MINE.W) return "quit";
		if (
			st.y < row &&
			seenAt(st, st.x, st.y + 1) &&
			at(st, st.x, st.y + 1) !== CELL.AIR &&
			at(st, st.x, st.y + 1) !== CELL.LAVA &&
			solid(st.x, st.y + 2)
		)
			return "down";
		const r = at(st, st.x + 1, st.y);
		if (seenAt(st, st.x + 1, st.y) && (r === CELL.LAVA || r === CELL.BEDROCK))
			return st.y > 0 ? "up" : "quit";
		return "right";
	};
};

const runBots = (
	mk: (st: MineState, rand: Rand) => () => MineAct,
	n: number,
) => {
	const out = { dia: 0, max: 0, lava: 0, takumi: 0 };
	for (let seed = 1; seed <= n; seed++) {
		const st = mineNew(seeded(seed));
		const b = mk(st, seeded(seed * 7 + 1));
		let idle = 0;
		for (let i = 0; i < 600 && !st.over && idle <= 20; i++) {
			const before = st.steps;
			mineAct(st, b());
			idle = st.steps === before ? idle + 1 : 0;
		}
		out.dia += st.dia;
		out.max = Math.max(out.max, st.dia);
		if (st.over === "lava") out.lava++;
		if (st.over === "takumi") out.takumi++;
	}
	return out;
};

test("ブラマイ：釣りあい（松明で 見て 掘る 人は 平均 2.3〜4.5個・溶岩で 0・匠で 2割まで。直下掘りの 人は ほとんど 取れない。段5 を 見ずに 押しつづけると 溶岩に のまれ、気づいて もどる 人が いちばん 取れる）", () => {
	const N = 200;
	const careful = runBots(
		(st, r) =>
			bot(st, r, { torchP: 1, checkP: 1, fleeP: 0.95, row: 4, react: 1 }),
		N,
	);
	ok(
		careful.dia / N >= 2.3 && careful.dia / N <= 4.5,
		`careful avg ${careful.dia / N}`,
	);
	ok(careful.lava === 0, `careful lava ${careful.lava}`);
	ok(careful.takumi <= N * 0.2, `careful takumi ${careful.takumi}`);
	ok(careful.max >= 7, `careful max ${careful.max}`);
	const reckless = runBots(
		(st, r) =>
			bot(st, r, { torchP: 0, checkP: 0, fleeP: 0.5, row: 6, startX: 6 }),
		N,
	);
	ok(reckless.dia / N <= 1.6, `reckless avg ${reckless.dia / N}`);
	ok(
		reckless.lava + reckless.takumi >= N * 0.7,
		`reckless ends ${reckless.lava}+${reckless.takumi}`,
	);
	// 見ずに 押しつづける 段5 横穴は もう 楽勝 では ない（content 審査の「いちばん 強い 掘り方」の 上限。
	// 板は あふれた ところで 長押しを 止める ので、のまれるのは 止まった あとも → を 押した とき）
	const hold = runBots((st, r) => row5Bot(st, r, 0), N);
	ok(hold.lava >= N * 0.3, `row-5 hold lava ${hold.lava}`);
	ok(hold.dia / N <= careful.dia / N, `row-5 hold avg ${hold.dia / N}`);
	// 気づいて もどれば 溶岩で 終わらない（うまい 人は いちばん 取れる。でも 1回 平均 6個 まで）
	const tap = runBots((st, r) => row5Bot(st, r, 1), N);
	ok(tap.lava === 0, `row-5 tap lava ${tap.lava}`);
	ok(
		tap.dia / N >= careful.dia / N && tap.dia / N <= 6,
		`row-5 tap avg ${tap.dia / N}`,
	);
});

// ───────────────── 村での 流れ（板は 差しかえ） ─────────────────

const STORE = new Map<string, string>();
const withStorage = async (fn: () => Promise<void>): Promise<void> => {
	const prev = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
	STORE.clear();
	Object.defineProperty(globalThis, "localStorage", {
		value: {
			getItem: (k: string) => STORE.get(k) ?? null,
			setItem: (k: string, v: string) => STORE.set(k, v),
			removeItem: (k: string) => STORE.delete(k),
		},
		configurable: true,
		writable: true,
	});
	forgetSabaMemo();
	try {
		await fn();
	} finally {
		forgetSabaMemo();
		setSabaNow(null);
		setMineHook(null);
		if (prev) Object.defineProperty(globalThis, "localStorage", prev);
		else delete (globalThis as { localStorage?: unknown }).localStorage;
	}
};
/** 地の文・セリフ・選ぶ・音・旗・暗転を 記録する 台本の 相手（選ぶ ときは picks を 順に）。 */
const recorder = (
	picks: number[] = [],
	pos: [number, number, Dir] = [14, 44, "up"],
) => {
	const log: string[] = [];
	const state: VState = { x: pos[0], y: pos[1], dir: pos[2], flags: {} };
	const s = new Proxy({} as Story, {
		get: (_t, k) => {
			if (k === "state") return state;
			if (k === "narrate")
				return async (t: string) => void log.push(`narrate: ${t}`);
			if (k === "say")
				return async (_w: unknown, t: string, o?: { name?: string }) =>
					void log.push(`say(${o?.name ?? ""}): ${t}`);
			if (k === "choose")
				return async (opts: string[]) => {
					log.push(`choose: ${opts.join("/")}`);
					return picks.shift() ?? opts.length - 1;
				};
			if (k === "flag") return (n: string) => state.flags[n];
			if (k === "set")
				return (n: string, v: boolean | number | string = true) => {
					state.flags[n] = v;
				};
			if (k === "se") return (n: string) => void log.push(`se ${n}`);
			if (k === "show") return (id: string) => void log.push(`show ${id}`);
			if (k === "hide") return (id: string) => void log.push(`hide ${id}`);
			if (k === "place")
				return (id: string, x: number, y: number) =>
					void log.push(`place ${id} ${x},${y}`);
			if (k === "fadeOut") return async () => void log.push("fadeOut");
			if (k === "fadeIn") return async () => void log.push("fadeIn");
			if (k === "then") return undefined;
			return async () => undefined;
		},
	});
	return { s, log, state };
};
const ctx = {} as Ctx;
const fac = (id: string) => {
	const f = facilityById(id);
	if (!f) throw new Fail(`no ${id}`);
	return f;
};
const DAY = { m: 10, d: 7, w: 3 };
const now = (o: { stage: number; at: number; hour?: number }) =>
	setSabaNow(() => ({ hour: 12, day: DAY, ...o }));

test("ホシュクラ：投票箱（入れる → 同じ 帰りは 開票まち → 次の 帰りで 開票）・初期スポの 看板に 決まった 名前", async () => {
	await withStorage(async () => {
		sabaEvents(view(3));
		now({ stage: 3, at: 10 });
		const t0 = recorder();
		await sabaPlay(ctx, t0.s, fac("saba3"), "town", true);
		ok(
			t0.log[0] === `narrate: ${X.townSign.replace("{name}", X.voteDefault)}`,
			t0.log.join("\n"),
		);
		const a = recorder([1]);
		await sabaPlay(ctx, a.s, fac("saba3"), "vote", true);
		ok(
			a.log.includes(`narrate: ${X.voteName.replace("{name}", X.voteDefault)}`),
			a.log.join("\n"),
		);
		ok(
			a.log.includes(`choose: ${[...X.cands[3], X.voteStop].join("/")}`),
			a.log.join("\n"),
		);
		ok(a.log.includes(`narrate: ${X.voteDone}`), a.log.join("\n"));
		ok(
			JSON.parse(STORE.get("kiriko-roguelike/saba") ?? "{}").votes?.["3"]
				?.pick === 1,
			"not saved",
		);
		const b = recorder();
		await sabaPlay(ctx, b.s, fac("saba3"), "vote", true);
		ok(
			b.log.includes(`narrate: ${X.voteWait}`) &&
				!b.log.some((l) => l.startsWith("choose")),
			b.log.join("\n"),
		);
		now({ stage: 3, at: 11 });
		const c = recorder();
		await sabaPlay(ctx, c.s, fac("saba3"), "vote", true);
		const res = X.voteResult
			.replace("{name}", X.cands[3][1])
			.replace("{other}", X.cands[3][0]);
		ok(c.log[0] === `narrate: ${res}`, c.log.join("\n"));
		const d = recorder();
		await sabaPlay(ctx, d.s, fac("saba3"), "vote", true);
		ok(
			d.log[0] === `narrate: ${X.voteName.replace("{name}", X.cands[3][1])}`,
			d.log.join("\n"),
		);
		const t1 = recorder();
		await sabaPlay(ctx, t1.s, fac("saba3"), "town", true);
		ok(
			t1.log[0] === `narrate: ${X.townSign.replace("{name}", X.cands[3][1])}`,
			t1.log.join("\n"),
		);
	});
});

test("ホシュクラ：ブラマイ場（やめれば 板なし・ダイヤの 記録は いちばん 多い 回だけ 書きかわる）", async () => {
	await withStorage(async () => {
		now({ stage: 3, at: 10 });
		let calls = 0;
		setMineHook(async () => {
			calls++;
			return { dia: calls === 1 ? 3 : 1, end: "broke" };
		});
		const cancel = recorder([1]);
		await sabaPlay(ctx, cancel.s, fac("saba3"), "mine", true);
		ok(calls === 0, "the board opened after やめる");
		const a = recorder([0]);
		await sabaPlay(ctx, a.s, fac("saba3"), "mine", true);
		ok(
			a.log.includes(
				`narrate: ${X.mineAfter.broke.replace("{tail}", X.mineTail.replace("{n}", "3"))}`,
			),
			a.log.join("\n"),
		);
		ok(
			a.log.includes(`narrate: ${X.mineBest.replace("{n}", "3")}`),
			a.log.join("\n"),
		);
		const b = recorder([0]);
		await sabaPlay(ctx, b.s, fac("saba3"), "mine", true);
		ok(
			b.log[0] === `narrate: ${X.mineRecord.replace("{n}", "3")}`,
			b.log.join("\n"),
		);
		ok(!b.log.some((l) => l.includes("書きかわった")), b.log.join("\n"));
		ok(
			loadSaba().mine.best === 3 &&
				loadSaba().mine.runs === 2 &&
				loadSaba().mine.total === 4,
			JSON.stringify(loadSaba().mine),
		);
	});
});

test("ホシュクラ：夜の 島で 帰りごとに 1回だけ 匠（キリコの うしろ・昼・寝た 帰り・>>1 の 看板の あと・部屋では 出ない・次の 帰りは また 出る）", async () => {
	await withStorage(async () => {
		sabaEvents(view(3));
		now({ stage: 3, at: 10 });
		// 鯖缶を (12,44) から 下向きに 読む → うしろは (12,43)
		const day = recorder([], [12, 44, "down"]);
		await sabaPlay(ctx, day.s, fac("saba3"), "sabakan", true);
		ok(!day.log.some((l) => l.includes(TAKUMI_ID)), day.log.join("\n"));
		now({ stage: 3, at: 10, hour: 22 });
		const sign = recorder([], [16, 44, "up"]);
		await sabaPlay(ctx, sign.s, fac("saba3"), "rules", true);
		ok(!sign.log.some((l) => l.includes(TAKUMI_ID)), sign.log.join("\n"));
		const n = recorder([], [12, 44, "down"]);
		await sabaPlay(ctx, n.s, fac("saba3"), "sabakan", true);
		ok(
			n.log.includes(`show ${TAKUMI_ID}`) &&
				n.log.includes(`hide ${TAKUMI_ID}`),
			n.log.join("\n"),
		);
		ok(
			n.log.includes("place saba_takumi 12,43"),
			`behind Kiriko: ${n.log.join("\n")}`,
		);
		const n1 = loadSaba().n;
		for (const t of [
			X.takumi[0],
			X.takumiTurn[n1 % X.takumiTurn.length],
			X.takumi[1],
		])
			ok(n.log.includes(`narrate: ${t}`), t);
		ok(n.state.flags[TAKUMI_SEEN] === 10, "the seen flag is not the return");
		await sabaPlay(ctx, n.s, fac("saba3"), "sabakan", true);
		ok(
			n.log.filter((l) => l === `show ${TAKUMI_ID}`).length === 1,
			"twice in a return",
		);
		// 次の 帰り（同じ ページ。旗は 残っている）→ また 出る、ふりむいた ときの 文は かわる
		now({ stage: 3, at: 11, hour: 22 });
		await sabaPlay(ctx, n.s, fac("saba3"), "sabakan", true);
		ok(
			n.log.filter((l) => l === `show ${TAKUMI_ID}`).length === 2,
			"not again next return",
		);
		ok(
			n.log.includes(
				`narrate: ${X.takumiTurn[(n1 + 1) % X.takumiTurn.length]}`,
			),
			"the turn line did not change",
		);
		const slept = recorder([], [12, 44, "down"]);
		slept.state.flags[ASA] = 11;
		await sabaPlay(ctx, slept.s, fac("saba3"), "sabakan", true);
		ok(!slept.log.some((l) => l.includes(TAKUMI_ID)), slept.log.join("\n"));
		const room = recorder();
		await sabaPlay(ctx, room.s, fac("saba3"), "bed", false);
		ok(!room.log.some((l) => l.includes(TAKUMI_ID)), "in a room");
	});
});

test("ホシュクラ：ベッド（昼は 眠れない・夜は 誰や 寝てないのは → もぐる → 暗転（文なし）→ 朝やで → 鯖缶も 朝・次の 帰りは また 寝られる）", async () => {
	await withStorage(async () => {
		now({ stage: 2, at: 10 });
		const d = recorder();
		await sabaPlay(ctx, d.s, fac("saba2"), "bed", false);
		ok(d.log.join("|") === `narrate: ${X.bedDay}`, d.log.join("\n"));
		now({ stage: 2, at: 10, hour: 23 });
		const n = recorder([0]);
		await sabaPlay(ctx, n.s, fac("saba2"), "bed", false);
		const want = [
			`choose: ${X.bedMenu.join("/")}`,
			`say(鯖民): ${X.bedWho}`,
			`narrate: ${X.bedSleep}`,
			"se sleep",
			"fadeOut",
			"se chapter",
			"fadeIn",
			`say(鯖缶): ${X.bedAsa}`,
		];
		ok(JSON.stringify(n.log) === JSON.stringify(want), n.log.join("\n"));
		// 暗転の あいだに 窓を 出さない（幕は 窓より 上）
		const i = n.log.indexOf("fadeOut");
		const j = n.log.indexOf("fadeIn");
		ok(
			!n.log
				.slice(i, j)
				.some((l) => l.startsWith("narrate") || l.startsWith("say")),
			"a window under the fade",
		);
		ok(n.state.flags[ASA] === 10, "asa");
		await sabaPlay(ctx, n.s, fac("saba2"), "sabakan", true);
		ok(n.log.includes(`say(鯖缶): ${X.morning}`), n.log.join("\n"));
		await sabaPlay(ctx, n.s, fac("saba2"), "bed", false);
		ok(n.log.includes(`narrate: ${X.bedMorning}`), n.log.join("\n"));
		// 次の 帰り（旗は 残る）→ 鯖缶は 夜の 文、ベッドは また 寝られる
		now({ stage: 2, at: 11, hour: 23 });
		const m = recorder([1]);
		m.state.flags[ASA] = 10;
		await sabaPlay(ctx, m.s, fac("saba2"), "sabakan", true);
		ok(m.log.includes(`say(鯖缶): ${X.night}`), m.log.join("\n"));
		await sabaPlay(ctx, m.s, fac("saba2"), "bed", false);
		ok(m.log.includes(`choose: ${X.bedMenu.join("/")}`), m.log.join("\n"));
	});
});

test("ホシュクラ：帰りごとに 進む（鯖缶の お知らせ・湧き潰しの 小言 （37回目）〜・水槽）", async () => {
	await withStorage(async () => {
		now({ stage: 6, at: 10 });
		const a = recorder();
		await sabaPlay(ctx, a.s, fac("saba6"), "sabakan", true);
		await sabaPlay(ctx, a.s, fac("saba6"), "sabakan", true);
		const lines = a.log.filter((l) => l.startsWith("say(鯖缶)"));
		ok(
			lines.length === 2 && lines[0] === lines[1],
			"the notice moved inside a return",
		);
		await sabaPlay(ctx, a.s, fac("saba6"), "joukyu", true);
		await sabaPlay(ctx, a.s, fac("saba6"), "joukyu", true);
		ok(
			a.log.filter((l) => l.includes("回目")).length === 1 &&
				a.log.some((l) => l.includes(`（${NAG_BASE + 1}回目）`)),
			a.log.join("\n"),
		);
		await sabaPlay(ctx, a.s, fac("saba6"), "tank", true);
		ok(!a.log.some((l) => l.includes("はり紙")), "tank on the first return");
		now({ stage: 6, at: 11 });
		const b = recorder();
		await sabaPlay(ctx, b.s, fac("saba6"), "sabakan", true);
		await sabaPlay(ctx, b.s, fac("saba6"), "joukyu", true);
		await sabaPlay(ctx, b.s, fac("saba6"), "tank", true);
		ok(b.log[0] !== lines[0], "the notice did not move");
		ok(
			b.log.some((l) => l.includes(`（${NAG_BASE + 2}回目）`)),
			b.log.join("\n"),
		);
		ok(b.log.includes(`narrate: ${X.tankNote}`), b.log.join("\n"));
		ok(loadSaba().n === 2, `n = ${loadSaba().n}`);
	});
});

test("ホシュクラ：102号室に 表札を 書くと 入居（外の 表札にも）", async () => {
	await withStorage(async () => {
		now({ stage: 4, at: 10 });
		const a = recorder([0]);
		await sabaPlay(ctx, a.s, fac("saba_apart"), "room102", false);
		ok(
			a.log.includes(`narrate: ${X.room102Write}`) && loadSaba().apart,
			a.log.join("\n"),
		);
		const b = recorder();
		await sabaPlay(ctx, b.s, fac("saba_apart"), "plate", true);
		ok(b.log[0] === `narrate: ${X.plateKiriko}`, b.log.join("\n"));
		const c = recorder();
		await sabaPlay(ctx, c.s, fac("saba_apart"), "room102", false);
		ok(c.log[0] === `narrate: ${X.room102In}`, c.log.join("\n"));
	});
});

test("ホシュクラ：共有の 振り分けを 通る（村の 地図の 豚と 匠・鯖缶と 看板の 物・豆腐ハウスの ベッド）", async () => {
	await withStorage(async () => {
		const v3 = view(3);
		const village = buildVillage(v3, {} as Ctx).events ?? [];
		ok(
			village.some((e) => e.id === PIG_ID) &&
				village.some((e) => e.id === TAKUMI_ID),
			"buildVillage has no pig / takumi (villageEvents.ts sabaEvents)",
		);
		now({ stage: 3, at: 10 });
		const f3 = fac("saba3");
		const kan = f3.outdoor?.find((t) => t.id === "sabakan");
		const ev = kan && village.find((e) => e.id === outdoorId(f3, kan));
		ok(ev?.run, "the 鯖缶 cannot be talked to");
		if (!kan || !ev?.run) return;
		const a = recorder([], [12, 44, "down"]);
		await ev.run(a.s);
		ok(
			JSON.stringify(a.log) ===
				JSON.stringify([
					...kan.lines.map((l) => `say(鯖缶): ${l}`),
					`say(鯖缶): ${noticeOf({ n: 1, stage: 3, day: DAY, hour: 12, asa: false })}`,
				]),
			`the 鯖缶 (ui/facilities.ts outdoorScript → sabaPlay):\n${a.log.join("\n")}`,
		);
		const town = f3.outdoor?.find((t) => t.id === "town");
		const tev = town && village.find((e) => e.id === outdoorId(f3, town));
		ok(tev?.run, "the town sign cannot be read");
		if (tev?.run) {
			const b = recorder([], [11, 44, "up"]);
			await tev.run(b.s);
			ok(
				b.log[0] === `narrate: ${X.townSign.replace("{name}", X.voteDefault)}`,
				b.log.join("\n"),
			);
		}
		now({ stage: 2, at: 10, hour: 23 });
		const room = buildFacility(fac("saba2"), view(2), {} as Ctx).events ?? [];
		const bedEv = room.find((e) => e.id === "bed_0");
		ok(bedEv?.run, "no bed in the 豆腐ハウス");
		if (bedEv?.run) {
			const c = recorder([1], [1, 4, "up"]);
			await bedEv.run(c.s);
			ok(
				JSON.stringify(c.log) ===
					JSON.stringify([
						...X.tofuRoom.bed.map((l) => `narrate: ${l}`),
						`choose: ${X.bedMenu.join("/")}`,
					]),
				`the bed (ui/facilities.ts buildFacility → sabaPlay):\n${c.log.join("\n")}`,
			);
		}
	});
});

export const runSabaTests = async (): Promise<TestResult[]> => {
	const out: TestResult[] = [];
	for (const c of CASES) {
		try {
			await c.run();
			out.push({ id: "saba", name: c.name, ok: true });
		} catch (e) {
			out.push({
				id: "saba",
				name: c.name,
				ok: false,
				reason: e instanceof Error ? e.message : String(e),
			});
		}
	}
	return out;
};

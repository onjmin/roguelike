// 部室棟の 試験（pnpm test で いっしょに 動く。spec-bushitsu §9）。形は civicTests と 同じ（Fail・ok・{ id, name, ok, reason }）。
// B1〜B5：置き場所・部屋・絵・人の 歩行グラ。B6：文の 幅と 使わない 語。B7・B8：ワードウルフ・うろ覚えの 決まり。
// B10〜：村の 入口（ui/bushitsu.ts。板は 差しかえ）と 保存（kiriko-roguelike/bushitsu）。

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { TOWN_STAGES } from "../core/town";
import type { DungeonId } from "../core/types";
import {
	BS_BAD_NUMBER,
	BS_BOARD,
	BS_CLUBS,
	BS_DOOR,
	BS_MSG,
	BS_OUTDOOR,
	BS_STAFF,
	BS_THING_LINES,
	boshuLine,
	fillText,
	MUKASHI,
	nisshiWindows,
	OE_TOPICS,
	type OeKind,
	oeDrawing,
	oeFar,
	oeMild,
	oeReaction,
	oeRound,
	oeSession,
	type Rand,
	textWidth,
	WW_BUCHO,
	WW_IDS,
	WW_PAIRS,
	type WwDeal,
	wwDeal,
	wwVerdict,
	wwWho,
	wwWord,
} from "../data/bushitsu";
import { BS_CELLS, BS_IMG, BS_SIZE, bs } from "../data/bushitsuSheet";
import {
	FACILITIES,
	facilityById,
	facilityDoor,
	facilityOutside,
	facilityRoomPalette,
	facilityRoomRows,
} from "../data/village/facilities";
import {
	VILLAGE_SPOTS,
	type VillageView,
	villagePalette,
	villagePlaces,
	villageRows,
} from "../data/village/map";
import type { Story } from "../engine/defs";
import {
	forgetBushitsuMemo,
	loadBushitsu,
	saveBushitsu,
	setBushitsuBoards,
	setBushitsuEnv,
} from "../ui/bushitsu";
import type { Ctx } from "../ui/ctx";
import { buildFacility } from "../ui/facilities";
import type { TestResult } from "./monsterTests";

class Fail extends Error {}
const ok = (cond: unknown, why: string): void => {
	if (!cond) throw new Fail(why);
};

const CASES: { id: string; name: string; run: () => void | Promise<void> }[] =
	[];
const test = (id: string, name: string, run: () => void | Promise<void>) =>
	CASES.push({ id, name, run });

/** 種つきの 乱数（線形合同法）。 */
const lcg =
	(seed: number): Rand =>
	() => {
		seed = (seed * 1664525 + 1013904223) >>> 0;
		return seed / 4294967296;
	};

const must = () => {
	const f = facilityById("bushitsu");
	if (!f?.room) throw new Fail("no bushitsu");
	return f;
};
const view = (stage: number, step?: number): VillageView => ({
	stage,
	unlocked: ["shallow"],
	cleared: [],
	...(step === undefined ? {} : { step }),
});

// ───────────────── B1〜B5 置き場所・部屋・絵 ─────────────────

test(
	"B1",
	"施設：段4から（終わり なし）・(40,0) の 13×3・扉 (46,2)・外 (46,3)・町の 役所と 中華の うしろ・遊べる 物は 物",
	() => {
		const f = must();
		ok(f.from === 4 && f.until === undefined, `from ${f.from} ${f.until}`);
		ok(f.at[0] === 40 && f.at[1] === 0, `at ${f.at}`);
		ok(
			f.look.kind === "grid" &&
				f.look.rows.length === 3 &&
				f.look.rows.every((r) => [...r].length === 13),
			"not a 13x3 grid",
		);
		const d = facilityDoor(f);
		ok(d?.[0] === 46 && d[1] === 2, `door ${d}`);
		const o = facilityOutside(f);
		ok(o.x === 46 && o.y === 3 && o.dir === "down", `outside ${o.x},${o.y}`);
		const ix = (id: string) => FACILITIES.findIndex((x) => x.id === id);
		ok(ix("cityhall") >= 0 && ix("chuka") >= 0, "no cityhall / chuka");
		ok(
			ix("bushitsu") > ix("cityhall") && ix("bushitsu") > ix("chuka"),
			"order",
		);
		const things = new Set(Object.values(f.room?.things ?? {}));
		for (const [k, p] of Object.entries(f.room?.plays ?? {})) {
			ok(p === "bushitsu", `${k}: ${p}`);
			ok(things.has(k), `play ${k} is not a thing`);
		}
	},
);

/** 開き方 3通り（本編まで・もっとまで）。 */
const UNLOCKS: DungeonId[][] = [
	["shallow"],
	["shallow", "main"],
	["shallow", "main", "deep"],
];

test(
	"B2",
	"置き場所：段4〜7 で 扉・外の マス・外の 物 4つに 歩いて 行け、北の 通り（y3）と x46・x52 の すきまは あいたまま。段0〜3 は 何も ない",
	() => {
		for (let stage = 0; stage < TOWN_STAGES; stage++)
			for (const unlocked of UNLOCKS) {
				const v: VillageView = {
					stage,
					unlocked,
					cleared: unlocked.slice(0, -1),
				};
				const where = `stage ${stage} [${unlocked}]`;
				const places = villagePlaces(v);
				const mine = places.filter(
					(p) =>
						p.id === "door_f_bushitsu" || p.id.startsWith("fthing_bushitsu_"),
				);
				if (stage < 4) {
					ok(!mine.length, `${where}: ${mine.map((p) => p.id)}`);
					continue;
				}
				ok(mine.length === 5, `${where}: places ${mine.map((p) => p.id)}`);
				const rows = villageRows(v).map((r) => [...r]);
				const tiles = villagePalette(v);
				const pass = (x: number, y: number) =>
					!!tiles[rows[y]?.[x] ?? ""]?.passable &&
					!places.some((p) => p.sprite && p.x === x && p.y === y);
				const reach = new Set<string>();
				const [bx, by] = VILLAGE_SPOTS.boot;
				const queue: [number, number][] = [[bx, by]];
				reach.add(`${bx},${by}`);
				while (queue.length) {
					const [x, y] = queue.shift() as [number, number];
					for (const [dx, dy] of [
						[0, -1],
						[1, 0],
						[0, 1],
						[-1, 0],
					]) {
						const k = `${x + dx},${y + dy}`;
						if (reach.has(k) || !pass(x + dx, y + dy)) continue;
						reach.add(k);
						queue.push([x + dx, y + dy]);
					}
				}
				const at = (x: number, y: number) => reach.has(`${x},${y}`);
				const door = mine.find((p) => p.id === "door_f_bushitsu");
				ok(
					door?.x === 46 && door.y === 2 && door.trigger === "touch",
					`${where}: door ${door?.x},${door?.y}`,
				);
				ok(at(46, 2) && at(46, 3), `${where}: door not reachable`);
				for (const p of mine.filter((q) => q.id.startsWith("fthing_"))) {
					ok(p.y === 2 && !p.sprite, `${where}: ${p.id} at ${p.x},${p.y}`);
					const near = [
						[0, -1],
						[1, 0],
						[0, 1],
						[-1, 0],
					].some(
						([dx, dy]) =>
							at(p.x + dx, p.y + dy) &&
							!places.some(
								(q) =>
									q.trigger === "touch" && q.x === p.x + dx && q.y === p.y + dy,
							),
					);
					ok(near, `${where}: ${p.id} has no reachable side`);
				}
				for (let x = 40; x <= 52; x++) {
					ok(pass(x, 3), `${where}: (${x},3) blocked`);
					ok(
						!places.some((p) => p.x === x && p.y === 3),
						`${where}: a place on (${x},3)`,
					);
				}
				for (const x of [46, 52])
					for (let y = 3; y <= 7; y++)
						ok(pass(x, y) && at(x, y), `${where}: (${x},${y}) not open`);
			}
	},
);

/** 部室棟の 絵の 参照なら その 切り出し。 */
const bsCrop = (ref: string): number[] | null =>
	ref.startsWith(`${BS_IMG}#`)
		? ref
				.slice(BS_IMG.length + 1)
				.split(",")
				.map(Number)
		: null;

test(
	"B3",
	"部屋：部長 7人の 席・放送部の 台（まん中は 物なし、両わきは ミキサー・ラジカセ）・ON AIR の 絵・部室棟の 絵は 枠の 中",
	() => {
		const f = must();
		const room = f.room;
		ok(room, "no room");
		if (!room) return;
		const want: Record<string, [number, number]> = {
			bs_jinro: [2, 3],
			bs_oekaki: [9, 4],
			bs_hoso: [15, 3],
			bs_voca: [21, 4],
			bs_game: [28, 4],
			bs_gassho: [6, 7],
			bs_kitaku: [17, 9],
		};
		const people = room.people ?? [];
		ok(people.length === 7, `${people.length} people`);
		for (const p of people) {
			const w = want[p.id];
			ok(w && p.at[0] === w[0] && p.at[1] === w[1], `${p.id} at ${p.at}`);
		}
		const rows = facilityRoomRows(f).map((r) => [...r]);
		const pal = facilityRoomPalette(f);
		const ch = (x: number, y: number) => rows[y][x];
		ok(pal[ch(15, 4)]?.counter && !room.things[ch(15, 4)], "(15,4)");
		ok(
			pal[ch(14, 4)]?.counter && room.things[ch(14, 4)] === "mixer",
			"(14,4) mixer",
		);
		ok(
			pal[ch(16, 4)]?.counter && room.things[ch(16, 4)] === "radio",
			"(16,4) radio",
		);
		const lamp = pal.O?.layers ?? [];
		ok(
			lamp.includes(bs("lampOn")) || lamp.includes(bs("lampOff")),
			`lamp ${lamp}`,
		);
		// 外観と 部屋の 部室棟の 絵：枠の 中・16の 目・どれかの 絵の 中
		const refs = [
			...(f.look.kind === "grid" ? Object.values(f.look.keys).flat() : []),
			...Object.values(pal).flatMap((t) => [...t.layers, ...(t.above ?? [])]),
		];
		const rects = Object.values(BS_CELLS);
		let n = 0;
		for (const r of refs) {
			const c = bsCrop(r);
			if (!c) continue;
			n++;
			const [x, y, w, h] = c;
			ok(
				x >= 0 && y >= 0 && x + w <= BS_SIZE[0] && y + h <= BS_SIZE[1],
				`${r} out of the sheet`,
			);
			ok(x % 16 === 0 && y % 16 === 0 && w % 16 === 0 && h % 16 === 0, r);
			ok(
				rects.some(
					([rx, ry, rw, rh]) =>
						x >= rx && y >= ry && x + w <= rx + rw && y + h <= ry + rh,
				),
				`${r} is in no cell`,
			);
		}
		ok(n >= 30, `only ${n} bushitsu refs`);
	},
);

test(
	"B4",
	"絵：public/sprites/bushitsu.png が BS_SIZE、48 枚（部長・合唱部の 顔色 3つ・下駄箱 2マス）",
	() => {
		const png = readFileSync(
			join(process.cwd(), "public/sprites/bushitsu.png"),
		);
		ok(png.toString("ascii", 12, 16) === "IHDR", "not a PNG");
		const w = png.readUInt32BE(16);
		const h = png.readUInt32BE(20);
		ok(w === BS_SIZE[0] && h === BS_SIZE[1], `${w}x${h}`);
		const names = Object.keys(BS_CELLS);
		ok(names.length === 48, `${names.length} cells`);
		for (const n of [
			"bucho",
			"gassho0",
			"gassho1",
			"gassho2",
			"getaL",
			"getaR",
		])
			ok(names.includes(n), `no ${n}`);
	},
);

/** src の ファイル（再帰）。 */
const srcFiles = (dir: string): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
		e.isDirectory()
			? srcFiles(join(dir, e.name))
			: /\.(ts|js|mjs|json)$/.test(e.name)
				? [join(dir, e.name)]
				: [],
	);

test(
	"B5",
	"部長の 歩行グラ：7つの ちがう sa:。src の どこにも ほかに 出てこない（data/bushitsu.ts だけ）",
	() => {
		const walks: string[] = Object.values(BS_STAFF).map((s) => s.walk);
		ok(new Set(walks).size === 7, `walks ${walks}`);
		for (const w of walks) ok(/^sa:[A-Za-z0-9]{6}$/.test(w), w);
		const room = must().room;
		ok(
			(room?.people ?? []).every((p) => walks.includes(p.walk)),
			"room people use other sheets",
		);
		const root = join(process.cwd(), "src");
		const home = join(root, "data", "bushitsu.ts");
		const ids = walks.map((w) => w.slice(3));
		for (const file of srcFiles(root)) {
			if (file === home) continue;
			const body = readFileSync(file, "utf8");
			for (const id of ids)
				ok(!body.includes(id), `${id} also in ${file.slice(root.length)}`);
		}
	},
);

// ───────────────── B6 文 ─────────────────

/** 窓（2行・1行 22 まで）。 */
const fitsWindow = (where: string, t: string, rows = 2): void => {
	const lines = t.split("\n");
	ok(lines.length <= rows, `${where}: ${lines.length} lines "${t}"`);
	for (const l of lines)
		ok(textWidth(l) <= 22, `${where}: "${l}" is ${textWidth(l)} wide`);
	ok(!/\{\w+\}/.test(t), `${where}: unfilled "${t}"`);
};
/** 板の 1行（22 まで）。 */
const fitsLine = (where: string, t: string, max = 22): void => {
	ok(!t.includes("\n"), `${where}: 2 lines "${t}"`);
	ok(textWidth(t) <= max, `${where}: "${t}" is ${textWidth(t)} wide`);
	ok(!/\{\w+\}/.test(t), `${where}: unfilled "${t}"`);
};
/** 使わない 語（保守・落ち・絵文字・★・扌）。 */
const ng = (where: string, t: string): void => {
	ok(!/保守|落ち|★|扌/.test(t), `${where}: NG word in "${t}"`);
	ok(!/\p{Extended_Pictographic}/u.test(t), `${where}: emoji in "${t}"`);
};
/** 文字列の 葉を ぜんぶ（[道, 文]）。 */
const leaves = (o: unknown, path: string): [string, string][] =>
	typeof o === "string"
		? [[path, o]]
		: Array.isArray(o)
			? o.flatMap((x, i) => leaves(x, `${path}[${i}]`))
			: o && typeof o === "object"
				? Object.entries(o).flatMap(([k, x]) => leaves(x, `${path}.${k}`))
				: [];

/** 埋める 値（いちばん 長い もの）。 */
const WIDE = {
	n: 999,
	s: "99.9",
	d: "99.9",
};

test(
	"B6",
	"文：窓は 2行・22 まで、板は 1行・22 まで、選ぶ 札は 10 まで、お題の ひとことは 8 まで。使わない 語なし。作る 文も 合う",
	() => {
		const all: [string, string][] = [
			["door", BS_DOOR],
			...leaves(BS_OUTDOOR, "outdoor"),
			...leaves(BS_THING_LINES, "things"),
			...Object.entries(BS_STAFF).flatMap(([k, s]) =>
				leaves(s.lines, `staff.${k}`),
			),
		];
		for (const [w, t] of all) {
			fitsWindow(w, t);
			ng(w, t);
		}
		for (const [k, s] of Object.entries(BS_STAFF))
			ok(s.lines.length >= 1 && s.lines.length <= 2, `staff ${k} windows`);
		for (const [k, l] of Object.entries(BS_THING_LINES))
			ok(l.length >= 1 && l.length <= 3, `thing ${k}: ${l.length} windows`);
		// 窓の 文（埋めて から）
		const titles = BS_MSG.nt.titles;
		for (const [w, t] of leaves(BS_MSG, "msg")) {
			ng(w, t);
			if (/\.menu\[/.test(w)) {
				ok(textWidth(t) <= 10, `${w}: label "${t}" ${textWidth(t)}`);
				continue;
			}
			if (w.startsWith("msg.boshu")) continue;
			if (w === "msg.nt.title") {
				for (const title of titles) fitsWindow(w, fillText(t, { title }));
				continue;
			}
			fitsWindow(w, fillText(t, WIDE));
		}
		for (const c of BS_CLUBS)
			fitsWindow(
				"boshu",
				fillText(c.hane ? BS_MSG.boshu.hane : BS_MSG.boshu.part, {
					club: c.name,
					n: 9999,
				}),
			);
		ok(BS_MSG.nt.titles.length === 7 && BS_MSG.nt.host.length === 7, "7 days");
		ok(BS_MSG.nt.host[0] === "" && BS_MSG.nt.host[6] === "", "weekend host");
		for (const f of MUKASHI) {
			ok(f.lines.length === 1, `${f.year}: ${f.lines.length} windows`);
			for (const l of f.lines) {
				fitsWindow(`mukashi ${f.year}`, l);
				ng(`mukashi ${f.year}`, l);
			}
		}
		// 板の 文
		const hints = WW_PAIRS.flatMap((p) => [
			...p.common,
			...p.own[0],
			...p.own[1],
		]);
		const words = WW_PAIRS.flatMap((p) => [p.a, p.b]);
		for (const [w, t] of leaves(BS_BOARD, "board")) {
			ng(w, t);
			if (w === "board.ww.turn") {
				for (const who of ["ID:Ab3x", BS_BOARD.ww.bucho])
					for (const hint of hints) fitsLine(w, fillText(t, { who, hint }));
			} else if (w === "board.ww.card" || w === "board.ww.wolf") {
				for (const word of words) fitsLine(w, fillText(t, { word }), 11);
			} else if (w === "board.ww.vote") {
				fitsLine(w, fillText(t, { who: "ID:Ab3x" }));
			} else if (w === "board.ww.id") {
				fitsLine(w, fillText(t, { id: "Ab3x" }));
			} else if (w === "board.oe.start") {
				for (const t2 of OE_TOPICS) fitsLine(w, fillText(t, { name: t2.name }));
			} else fitsLine(w, fillText(t, WIDE));
		}
		// ワードウルフの お題
		ok(new Set(WW_PAIRS.map((p) => p.id)).size === WW_PAIRS.length, "pair ids");
		for (const p of WW_PAIRS) {
			ok(
				p.common.length === 3 && p.own[0].length === 4 && p.own[1].length === 4,
				`${p.id}: pools`,
			);
			const pool = [...p.common, ...p.own[0], ...p.own[1]];
			ok(new Set(pool).size === pool.length, `${p.id}: duplicate hint`);
			for (const h of pool) {
				ok(textWidth(h) <= 8, `${p.id}: "${h}" ${textWidth(h)}`);
				ng(p.id, h);
			}
		}
		ok(new Set(WW_IDS).size === WW_IDS.length, "ids repeat");
		for (const id of WW_IDS)
			ok(id.length === 4 && !BS_BAD_NUMBER.test(id), `id ${id}`);
		// 作る 文
		for (let heard = 1; heard <= 20; heard++)
			for (const t of nisshiWindows(heard)) fitsWindow(`nisshi ${heard}`, t);
		ok(nisshiWindows(20).length <= 2, "nisshi windows");
		for (let v = 1; v <= 3000; v++) {
			const t = boshuLine(v);
			fitsWindow(`boshu ${v}`, t);
			const num = /(?:part|　)(\d+)/.exec(t.split("\n")[0])?.[1] ?? "";
			ok(num && !BS_BAD_NUMBER.test(num), `boshu ${v}: ${num}`);
		}
	},
);

// ───────────────── B7 ワードウルフ ─────────────────

/** 素直な 解き手（相手の お題だけの ことを 言った 席。いなければ あてずっぽう）・理づめ（自分の お題だけの 席も 外す）。 */
const winRate = (d: WwDeal, smart: boolean, rounds: number): number => {
	const minorOwn = d.pair.own[1 - d.major];
	const majorOwn = d.pair.own[d.major];
	const hs = d.hints.slice(0, rounds);
	const seats = [0, 1, 2, 3, 4];
	const flagged = seats.filter((i) => hs.some((r) => minorOwn.includes(r[i])));
	if (flagged.length) return flagged.includes(d.wolf) ? 1 / flagged.length : 0;
	const cands = smart
		? seats.filter((i) => !hs.some((r) => majorOwn.includes(r[i])))
		: seats;
	return cands.includes(d.wolf) ? 1 / cands.length : 0;
};

test(
	"B7",
	"ワードウルフ：配りと ひとことの 決まり・1周目で 当てる 見こみ 半分ほど・2周目で 8〜9割・部長が 人狼の 割合",
	() => {
		const rand = lcg(7);
		const N = 2000;
		let naive1 = 0;
		let naive2 = 0;
		let smart2 = 0;
		let bucho = 0;
		for (let n = 0; n < N; n++) {
			const d = wwDeal(rand);
			ok(d.wolf >= 0 && d.wolf < 5, `wolf ${d.wolf}`);
			ok(d.ids.length === 5 && new Set(d.ids).size === 5, `ids ${d.ids}`);
			const minor = 1 - d.major;
			const [r1, r2] = d.hints;
			ok(new Set(r1).size === 5 && new Set(r2).size === 5, "dup in a round");
			for (let i = 0; i < 5; i++) {
				const own = i === d.wolf ? d.pair.own[minor] : d.pair.own[d.major];
				ok(
					d.pair.common.includes(r1[i]) || own.includes(r1[i]),
					`r1 ${i} "${r1[i]}"`,
				);
				ok(
					d.pair.common.includes(r2[i]) || own.includes(r2[i]),
					`r2 ${i} "${r2[i]}"`,
				);
				ok(r2[i] !== r1[i], `seat ${i} repeats "${r1[i]}"`);
			}
			const vagueVillagers = [0, 1, 2, 3, 4].filter(
				(i) => i !== d.wolf && d.pair.common.includes(r2[i]),
			);
			ok(vagueVillagers.length <= 1, `r2 vague ${vagueVillagers}`);
			naive1 += winRate(d, false, 1);
			naive2 += winRate(d, false, 2);
			smart2 += winRate(d, true, 2);
			if (d.wolf === WW_BUCHO) bucho++;
		}
		const r = (x: number) => x / N;
		ok(r(naive1) >= 0.35 && r(naive1) <= 0.55, `naive after 1: ${r(naive1)}`);
		ok(r(naive2) >= 0.8 && r(naive2) <= 0.92, `naive after 2: ${r(naive2)}`);
		ok(r(smart2) >= 0.97, `smart after 2: ${r(smart2)}`);
		ok(r(bucho) >= 0.15 && r(bucho) <= 0.25, `bucho wolf ${r(bucho)}`);
		const d = wwDeal(lcg(3));
		const other = (d.wolf + 1) % 5;
		ok(wwVerdict(d, d.wolf, 1) === "first", "verdict first");
		ok(wwVerdict(d, d.wolf, 2) === "second", "verdict second");
		ok(wwVerdict(d, other, 1) === "miss", "verdict miss");
		ok(wwWord(d, d.wolf) !== wwWord(d, "kiriko"), "wolf word");
		ok(wwWord(d, other) === wwWord(d, "kiriko"), "villager word");
		ok(wwWho(d, 2) === "部長", `who 2 ${wwWho(d, 2)}`);
		for (const i of [0, 1, 3, 4])
			ok(/^ID:[A-Za-z0-9]{4}$/.test(wwWho(d, i)), `who ${i} ${wwWho(d, i)}`);
	},
);

// ───────────────── B8 うろ覚え ─────────────────

const same = (a: unknown, b: unknown) =>
	JSON.stringify(a) === JSON.stringify(b);

test(
	"B8",
	"うろ覚え：くずし方は どれも 絵を かえ、正解は いつも 1枚。問が 進むほど 近い 絵が ふえる。ひとことは 板の 文",
	() => {
		const rand = lcg(4242);
		const still = () => 0.5;
		const notes = new Set<string>(leaves(BS_BOARD.oe, "").map(([, t]) => t));
		for (const t of OE_TOPICS) {
			const mainCount = t.parts.filter((p) => p.tag === t.main).length;
			for (const k of oeFar(t)) {
				const d = oeDrawing(t, [k], k === "jitter" ? rand : still);
				ok(!same(d.parts, t.parts), `${t.id}: ${k} alone changes nothing`);
				if (k === "extra")
					ok(d.parts.length === t.parts.length + 1, `${t.id}: extra`);
				if (k === "drop")
					ok(
						d.parts.filter((p) => p.tag === t.main).length === mainCount,
						`${t.id}: drop removed main`,
					);
			}
			ok(!t.drops.includes(t.main), `${t.id}: main in drops`);
			ok(
				t.drops.some((g) => g !== t.extra.tag),
				`${t.id}: drop+extra impossible`,
			);
			for (const g of t.drops)
				ok(
					t.parts.some((p) => p.tag === g),
					`${t.id}: drop tag ${g}`,
				);
			for (let s = 0; s < 50; s++) {
				const d = oeDrawing(t, ["drop", "extra"], rand);
				ok(
					d.parts.some((p) => p.tag === t.extra.tag),
					`${t.id}: drop removed the extra`,
				);
				ok(d.parts.length <= t.parts.length, `${t.id}: drop+extra`);
			}
			for (const round of [0, 1, 2] as const)
				for (let s = 0; s < 300; s++) {
					const { drawings, best } = oeRound(t, round, rand);
					ok(drawings.length === 3, "3 drawings");
					const errs = drawings.map((d) => d.error);
					ok(
						errs.filter((e) => e === errs[best]).length === 1 &&
							Math.min(...errs) === errs[best],
						`${t.id} r${round}: min ${errs} best ${best}`,
					);
					const b = drawings[best];
					if (round === 0)
						ok(same(b.kinds, ["wobble"]), `${t.id} r0 best ${b.kinds}`);
					else
						ok(
							b.kinds.length === 2 &&
								b.kinds[0] === "wobble" &&
								oeMild(t).includes(b.kinds[1]),
							`${t.id} r${round} best ${b.kinds}`,
						);
					const added: OeKind[] = [];
					for (const [i, d] of drawings.entries()) {
						if (!t.wrong)
							ok(!d.kinds.includes("color"), `${t.id}: color without wrong`);
						ok(
							notes.has(oeReaction(t, d, b, rand)),
							`${t.id}: reaction for ${d.kinds}`,
						);
						if (i === best) continue;
						ok(d.error >= b.error + 2, `${t.id} r${round}: far ${d.error}`);
						const more = d.kinds.find(
							(k) => k !== "wobble" && !b.kinds.includes(k),
						);
						ok(more, `${t.id} r${round}: far has no extra defect`);
						if (more) added.push(more);
						if (round === 2)
							ok(
								b.kinds.every((k) => d.kinds.includes(k)),
								`${t.id} r2: far lacks the shared defect`,
							);
					}
					if (round === 2)
						ok(added[0] !== added[1], `${t.id} r2: same defect twice`);
				}
		}
		const ss = oeSession(rand);
		ok(ss.length === 3 && new Set(ss.map((t) => t.id)).size === 3, "session");
	},
);

// ───────────────── B10〜 村の 入口と 保存 ─────────────────

/** 地の文・セリフ・選ぶ・待つ・音・曲を 記録する 台本の 相手（選ぶ ときは picks を 順に 返す）。 */
const recorder = (picks: number[] = []) => {
	const log: string[] = [];
	const s = new Proxy({} as Story, {
		get: (_t, k) => {
			if (k === "narrate")
				return async (t: string) => {
					log.push(`narrate: ${t}`);
				};
			if (k === "say")
				return async (_w: unknown, t: string, o?: { name?: string }) => {
					log.push(`say(${o?.name ?? ""}): ${t}`);
				};
			if (k === "choose")
				return async (opts: string[]) => {
					log.push(`choose: ${opts.join("/")}`);
					return picks.shift() ?? opts.length - 1;
				};
			if (k === "wait")
				return async () => {
					log.push("wait");
				};
			if (k === "se") return (x: string) => log.push(`se ${x}`);
			if (k === "bgm") return (x: string | null) => log.push(`bgm ${x}`);
			if (k === "then") return undefined;
			return () => undefined;
		},
	});
	return { s, log };
};

/** localStorage を 試験の あいだだけ 差しかえる。 */
const swapStorage = (): { store: Map<string, string>; restore: () => void } => {
	const store = new Map<string, string>();
	const prev = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
	Object.defineProperty(globalThis, "localStorage", {
		value: {
			getItem: (k: string) => store.get(k) ?? null,
			setItem: (k: string, v: string) => {
				store.set(k, v);
			},
			removeItem: (k: string) => {
				store.delete(k);
			},
		},
		configurable: true,
		writable: true,
	});
	return {
		store,
		restore: () => {
			if (prev) Object.defineProperty(globalThis, "localStorage", prev);
			else delete (globalThis as { localStorage?: unknown }).localStorage;
		},
	};
};

const KEY = "kiriko-roguelike/bushitsu";
const saved = (store: Map<string, string>) =>
	JSON.parse(store.get(KEY) ?? "null");

/** 部屋の 物を 調べる（静かな 文 → 遊び）。 */
const examine = async (thing: string, picks: number[] = [], stage = 4) => {
	const ev = (buildFacility(must(), view(stage), {} as Ctx).events ?? []).find(
		(e) => e.id === `${thing}_0`,
	);
	ok(ev?.run, `no ${thing}_0`);
	const r = recorder(picks);
	await ev?.run?.(r.s);
	return r.log;
};
const narr = (t: string) => `narrate: ${t}`;
const sayOf = (who: keyof typeof BS_STAFF, t: string) =>
	`say(${BS_STAFF[who].name}): ${t}`;
const thingLines = (k: string) => (BS_THING_LINES[k] ?? []).map(narr);

/** 部室棟の 試験の 前後（保存を 差しかえ、板と 時刻を もどす）。 */
const sandbox = async (fn: (store: Map<string, string>) => Promise<void>) => {
	const { store, restore } = swapStorage();
	forgetBushitsuMemo();
	try {
		await fn(store);
	} finally {
		setBushitsuBoards(null);
		setBushitsuEnv(null);
		forgetBushitsuMemo();
		restore();
	}
};

test(
	"B10",
	"机：やめる・人狼（10人）・ワードウルフ（はじめは 手引き 2窓 → 板 → 当たり → 部長）。続けて 当てると 数える。部長が 人狼の ときの 別れの 文",
	() =>
		sandbox(async (store) => {
			const M = BS_MSG.ww;
			setBushitsuEnv({ returnAt: () => 1000 });
			const menu = `choose: ${M.menu.join("/")}`;
			const quit = await examine("table", [2]);
			ok(
				quit.join("\n") === [...thingLines("table"), menu].join("\n"),
				`quit:\n${quit.join("\n")}`,
			);
			const ten = await examine("table", [1]);
			ok(
				ten.join("\n") ===
					[
						...thingLines("table"),
						menu,
						narr(M.tenNin),
						sayOf("jinro", M.jiki),
					].join("\n"),
				`ten:\n${ten.join("\n")}`,
			);
			let boards = 0;
			setBushitsuBoards({
				wordwolf: async () => {
					boards++;
					return { verdict: "first", pairId: "tako", wolfSeat: 0 };
				},
			});
			const a = await examine("table", [0]);
			ok(
				a.join("\n") ===
					[
						...thingLines("table"),
						menu,
						...M.howto.map(narr),
						"wait",
						narr(M.win1),
						sayOf("jinro", M.byeWin),
					].join("\n"),
				`first:\n${a.join("\n")}`,
			);
			const m = saved(store);
			ok(
				m?.ww.plays === 1 &&
					m.ww.wins === 1 &&
					m.ww.first === 1 &&
					m.ww.streak === 1 &&
					m.ww.howto === true &&
					m.visits === 1,
				`memo ${JSON.stringify(m)}`,
			);
			const b = await examine("table", [0]);
			ok(!b.some((l) => M.howto.some((h) => l.includes(h))), "howto twice");
			ok(
				b.includes(narr(fillText(M.streak, { n: 2 }))) &&
					b.includes(narr("……2回　つづけて　当てた。")),
				`streak:\n${b.join("\n")}`,
			);
			ok(boards === 2, `boards ${boards}`);
			setBushitsuBoards({
				wordwolf: async () => ({ verdict: "miss", pairId: "age", wolfSeat: 2 }),
			});
			const c = await examine("table", [0]);
			ok(
				c.slice(-2).join("\n") ===
					[narr(M.lose), sayOf("jinro", M.byeMeWon)].join("\n"),
				`miss:\n${c.join("\n")}`,
			);
			ok(saved(store).ww.streak === 0, "streak not reset");
			setBushitsuBoards({
				wordwolf: async () => ({
					verdict: "second",
					pairId: "age",
					wolfSeat: 2,
				}),
			});
			const d = await examine("table", [0]);
			ok(
				d.slice(-2).join("\n") ===
					[narr(M.win2), sayOf("jinro", M.byeMeFound)].join("\n"),
				`second:\n${d.join("\n")}`,
			);
			// やめた 板（null）は 数えない
			setBushitsuBoards({ wordwolf: async () => null });
			const before = saved(store).ww.plays;
			const e = await examine("table", [0]);
			ok(e.at(-1) === "wait", `null board:\n${e.join("\n")}`);
			ok(saved(store).ww.plays === before, "a quit board was counted");
			ok(saved(store).visits === 1, "one return counted twice");
		}),
);

test(
	"B11",
	"人狼（10人）：10回目の 帰りより あとに 1度だけ そろいかけて 1人 抜ける。2度目からは そろわない",
	() =>
		sandbox(async (store) => {
			const M = BS_MSG.ww;
			const m = loadBushitsu();
			m.visits = 9;
			m.visitAt = 5;
			saveBushitsu(m, false);
			setBushitsuEnv({ returnAt: () => 6 });
			const a = await examine("table", [1]);
			ok(
				a.slice(-3).join("\n") ===
					[narr(M.ten[0]), narr(M.ten[1]), sayOf("jinro", M.jiki)].join("\n"),
				`ten:\n${a.join("\n")}`,
			);
			ok(saved(store).ww.ten === true && saved(store).visits === 10, "memo");
			const b = await examine("table", [1]);
			ok(
				b.slice(-2).join("\n") ===
					[narr(M.tenNin), sayOf("jinro", M.jiki)].join("\n"),
				`again:\n${b.join("\n")}`,
			);
		}),
);

test(
	"B12",
	"ぬとらじ：昼の 平日は 流れない・夜は 曜日の 回・土日は 一日じゅう 昔話（帰りに 1つ）・日誌に 聞いた 年",
	() =>
		sandbox(async () => {
			const M = BS_MSG.nt;
			setBushitsuEnv({ h: () => 12, w: () => 3, returnAt: () => 100 });
			let r = await examine("radio");
			ok(
				r.join("\n") === [...thingLines("radio"), narr(M.off)].join("\n"),
				`noon:\n${r.join("\n")}`,
			);
			r = await examine("onair");
			ok(r.at(-1) === narr(M.lampOff), `lamp off ${r}`);
			setBushitsuEnv({ h: () => 22, w: () => 2, returnAt: () => 100 });
			r = await examine("radio");
			ok(
				r.join("\n") ===
					[
						...thingLines("radio"),
						narr(fillText(M.title, { title: M.titles[2] })),
						sayOf("hoso", M.host[2]),
					].join("\n"),
				`karaoke:\n${r.join("\n")}`,
			);
			ok(r.length === 3, "radio windows");
			r = await examine("onair");
			ok(r.at(-1) === narr(M.lampOn), `lamp on ${r}`);
			r = await examine("nisshi");
			ok(r.at(-1) === narr(M.nisshiNone), `blank diary ${r}`);
			setBushitsuEnv({ h: () => 12, w: () => 6, returnAt: () => 100 });
			r = await examine("radio");
			ok(
				r.slice(-2).join("\n") ===
					[
						narr(fillText(M.title, { title: M.titles[6] })),
						sayOf("hoso", MUKASHI[0].lines[0]),
					].join("\n"),
				`mukashi 0:\n${r.join("\n")}`,
			);
			r = await examine("radio");
			ok(r.at(-1) === sayOf("hoso", M.again), `again ${r}`);
			setBushitsuEnv({ h: () => 12, w: () => 6, returnAt: () => 200 });
			r = await examine("radio");
			ok(r.at(-1) === sayOf("hoso", MUKASHI[1].lines[0]), `mukashi 1 ${r}`);
			r = await examine("nisshi");
			ok(r.at(-1) === narr("昔話の　回：2回　ぶん\n2012"), `diary ${r.at(-1)}`);
			setBushitsuEnv({ h: () => 1, w: () => 1, returnAt: () => 200 });
			r = await examine("onair");
			ok(r.at(-1) === narr(M.lampOn), `late night ${r}`);
		}),
);

test(
	"B14",
	"部員募集：遊べる 物を 使った 帰りの 数で 部と 番号が かわる（はじめは 人狼部 part31、次は お糸会かき部 38羽目）",
	() =>
		sandbox(async (store) => {
			setBushitsuEnv({ returnAt: () => 10 });
			let r = await examine("boshu");
			ok(
				r.join("\n") ===
					[...thingLines("boshu"), narr(boshuLine(1))].join("\n") &&
					boshuLine(1).includes("「人狼部　部員募集　part31」"),
				`first:\n${r.join("\n")}`,
			);
			r = await examine("boshu");
			ok(r.at(-1) === narr(boshuLine(1)), "same return, same poster");
			setBushitsuEnv({ returnAt: () => 20 });
			r = await examine("boshu");
			ok(
				r.at(-1) === narr(boshuLine(2)) && boshuLine(2).includes("38羽目"),
				`second ${r.at(-1)}`,
			);
			ok(saved(store).visits === 2, "visits");
		}),
);

test(
	"B15",
	"下見の あいだ（noSave）は 保存に 書かず この回だけ 覚える。捨てると 保存から 読みなおす",
	() =>
		sandbox(async (store) => {
			const m = loadBushitsu();
			m.visits = 7;
			saveBushitsu(m, true);
			ok(!store.has(KEY), "written while previewing");
			ok(loadBushitsu().visits === 7, "not remembered");
			forgetBushitsuMemo();
			ok(loadBushitsu().visits === 0, "not forgotten");
			store.set(KEY, "{broken");
			ok(loadBushitsu().visits === 0, "broken json");
			store.set(KEY, JSON.stringify({ v: 1, visits: -3, ww: { plays: "x" } }));
			const bad = loadBushitsu();
			ok(bad.visits === 0 && bad.ww.plays === 0 && bad.visitAt === -1, "bad");
		}),
);

export const runBushitsuTests = async (): Promise<TestResult[]> => {
	const out: TestResult[] = [];
	for (const c of CASES) {
		try {
			await c.run();
			out.push({ id: `bushitsu ${c.id}`, name: c.name, ok: true });
		} catch (e) {
			out.push({
				id: `bushitsu ${c.id}`,
				name: c.name,
				ok: false,
				reason: e instanceof Error ? e.message : String(e),
			});
		}
	}
	return out;
};

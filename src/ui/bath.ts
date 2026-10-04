// 銭湯「ゆ」の 中の 人（地図と 調べる 物は data/village/rooms.ts・ui/rooms.ts、文は data/bath.ts）。
// - 番台：仕切りの 上に すわる 名無し。男湯の のれんを くぐろうと すると 止めて、キリコは 1歩 もどる。
// - 女湯：村に いる 女の子が 帰りごとに 湯船（つかって いる）か 脱衣所（着がえて いる）に 分かれる。
//   同じ 帰りなら 同じ 並び（記録の 終わった 時刻で 決める）。
// - 男湯：やきう（出ていった あとは 名無し）と ジェイトルマンが 仕切りの となりで つかって いて、壁ごしに 話す。
// - キリコが はじめて 湯に 入ると 地の文（銭湯に いるあいだ 1回）。

import {
	BANDAI,
	BATH_MEN,
	BATH_SOAK,
	BATH_WOMEN,
	type BathWoman,
} from "../data/bath";
import { CAST } from "../data/cast";
import { MOBS, type MobId } from "../data/mobs";
import type { Speaker } from "../data/quotes";
import { awayFriends, FRIEND_FROM } from "../data/story";
import { NANASHI_WALK } from "../data/village/hall";
import { npc } from "../data/village/helpers";
import { stepOf, type VillageView } from "../data/village/map";
import {
	BATH_BANDAI,
	BATH_NOREN_M,
	BATH_SPOTS,
	BATH_WALL,
	roomRows,
	type Spot,
} from "../data/village/rooms";
import type { EventDef, MapDef, Script, Story } from "../engine/defs";
import { loadRecords } from "../engine/save";
import { TILE } from "../engine/types";
import { sayAs } from "./villageMobs";

/** キリコが 湯に つかった 印（銭湯に いるあいだ）。 */
const SOAKED = "bathSoaked";

const FRIENDS = ["roze", "shiyo", "feris", "zero"] as const;
const MOB_WOMEN = ["ngoane", "onsu", "proto", "ren", "hinary"] as const;

const isFriend = (w: BathWoman): w is (typeof FRIENDS)[number] =>
	(FRIENDS as readonly string[]).includes(w);

/** 帰りごとの 並び（記録の 終わった 時刻から。同じ 帰りなら 同じ）。 */
const shuffled = <T>(list: readonly T[], seed: number): T[] => {
	const out = [...list];
	let h = seed >>> 0 || 1;
	for (let i = out.length - 1; i > 0; i--) {
		h = (Math.imul(h, 1103515245) + 12345) >>> 0;
		const j = h % (i + 1);
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
};

/** いま 村に いる 女湯の 人。 */
export const bathWomen = (v: VillageView): BathWoman[] => {
	const away = awayFriends(v.cleared, v.stage);
	return [
		...FRIENDS.filter((w) => v.stage >= FRIEND_FROM[w] && !away.includes(w)),
		...MOB_WOMEN.filter((id) => stepOf(v) >= MOBS[id].from),
	];
};

/** 女湯の 割りふり（交互に 湯船・脱衣所。あふれた 人は 来ていない）。 */
export const bathLayout = (
	v: VillageView,
	seed: number,
): { who: BathWoman; at: Spot; place: "soak" | "dress" }[] => {
	const out: { who: BathWoman; at: Spot; place: "soak" | "dress" }[] = [];
	let soak = 0;
	let dress = 0;
	shuffled(bathWomen(v), seed).forEach((who, i) => {
		if (i % 2 === 0 && soak < BATH_SPOTS.soak.length)
			out.push({ who, at: BATH_SPOTS.soak[soak++], place: "soak" });
		else if (dress < BATH_SPOTS.dress.length)
			out.push({ who, at: BATH_SPOTS.dress[dress++], place: "dress" });
		else if (soak < BATH_SPOTS.soak.length)
			out.push({ who, at: BATH_SPOTS.soak[soak++], place: "soak" });
	});
	return out;
};

/** 話して もとの 向きへ。 */
const talk =
	(id: string, dir: Spot["dir"], say: (s: Story) => Promise<void>): Script =>
	async (s) => {
		await say(s);
		s.face(id, dir);
	};

const sayLines = async (
	s: Story,
	who: Speaker | null,
	lines: readonly string[],
	name?: string,
): Promise<void> => {
	for (const l of lines) await s.say(who, l, name ? { name } : {});
};

/** 女湯の 人。 */
const woman = (who: BathWoman, at: Spot, place: "soak" | "dress"): EventDef => {
	const id = `bath_${who}`;
	const lines = BATH_WOMEN[who][place];
	if (isFriend(who))
		return npc(
			id,
			at.x,
			at.y,
			CAST[who].walk,
			talk(id, at.dir, (s) => sayLines(s, who, lines)),
			{ who, dir: at.dir },
		);
	const mob = who as MobId;
	return npc(
		id,
		at.x,
		at.y,
		MOBS[mob].sprite,
		talk(id, at.dir, async (s) => {
			for (const l of lines) await sayAs(s, mob, l);
		}),
		{ dir: at.dir },
	);
};

/**
 * 湯気（ui/rooms.ts の buildRoom が 銭湯の decor に する）。湯の マスごとに 白い もやが ゆらゆら
 * 立ちのぼって 消える。マスごとに 出る 時刻と 速さを ずらす。浴室の 上の ほうは うすく くもらせる。
 */
export const bathSteam = (): MapDef["decor"] => {
	const rows = roomRows("bath");
	const puffs: { x: number; y: number; phase: number; period: number }[] = [];
	let top = rows.length;
	let bottom = 0;
	rows.forEach((r, y) => {
		[...r].forEach((ch, x) => {
			if (ch !== "~") return;
			top = Math.min(top, y);
			bottom = Math.max(bottom, y);
			const h = (Math.imul(x * 31 + y * 17, 2654435761) >>> 0) / 2 ** 32;
			// 1マスに 2つ（半周 ずらす）
			for (const k of [0, 0.5])
				puffs.push({
					x: x * TILE + 3 + Math.floor(h * 10),
					y: y * TILE + 8,
					phase: h + k,
					period: 2600 + Math.floor(h * 1400),
				});
		});
	});
	const width = rows[0].length * TILE;
	return (g, ox, oy, t) => {
		g.save();
		// 浴室の くもり（ゆっくり 濃く うすく）
		const haze = 0.07 + 0.03 * Math.sin(t / 1700);
		const hy = TILE - oy;
		const hh = (bottom + 1) * TILE - TILE;
		const grad = g.createLinearGradient(0, hy, 0, hy + hh);
		grad.addColorStop(0, `rgba(255,255,255,${haze * 1.6})`);
		grad.addColorStop(1, `rgba(255,255,255,${haze * 0.4})`);
		g.fillStyle = grad;
		g.fillRect(TILE - ox, hy, width - TILE * 2, hh);
		// 立ちのぼる もや
		for (const p of puffs)
			puff(g, p.x - ox, p.y - oy, (t / p.period + p.phase) % 1, p.phase, {
				rise: TILE * 1.8,
				size: 6,
				alpha: 0.45,
			});
		g.restore();
	};
};

/** もや 1つ（a は 0→1 の 進み。立ちのぼりながら ふくらんで、ゆれて、消える）。 */
const puff = (
	g: CanvasRenderingContext2D,
	x: number,
	y: number,
	a: number,
	phase: number,
	o: { rise: number; size: number; alpha: number },
): void => {
	const cx = x + Math.sin(a * Math.PI * 2 + phase * 6) * 2.5 * a;
	const cy = y - a * o.rise;
	const r = 3 + a * o.size;
	// ふちを ぼかす（泡に 見えない ように）
	const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
	const al = Math.sin(a * Math.PI) * o.alpha;
	grad.addColorStop(0, `rgba(255,255,255,${al})`);
	grad.addColorStop(0.5, `rgba(255,255,255,${al * 0.6})`);
	grad.addColorStop(1, "rgba(255,255,255,0)");
	g.fillStyle = grad;
	g.fillRect(cx - r, cy - r, r * 2, r * 2);
};

/** 村の 地図の 銭湯の 煙突（Ц）から 立つ 湯気（ui/villageEvents.ts の decor）。煙突が なければ 無い。 */
export const chimneySteam = (rows: readonly string[]): MapDef["decor"] => {
	const tops: [number, number][] = [];
	rows.forEach((r, y) => {
		[...r].forEach((ch, x) => {
			if (ch === "Ц") tops.push([x * TILE + TILE / 2, y * TILE + 3]);
		});
	});
	if (!tops.length) return undefined;
	return (g, ox, oy, t) => {
		g.save();
		for (const [x, y] of tops)
			for (let i = 0; i < 4; i++)
				puff(g, x - ox, y - oy, (t / 3200 + i / 4) % 1, i * 0.37, {
					rise: TILE * 2.2,
					size: 7,
					alpha: 0.75,
				});
		g.restore();
	};
};

/** 銭湯の 人と しかけ（ui/rooms.ts の buildRoom が 足す）。 */
export const bathPeople = (v: VillageView): EventDef[] => {
	const seed = loadRecords()[0]?.at ?? 0;
	const out: EventDef[] = [];
	// 番台（台ごしに 話す）
	const [bx, by] = BATH_BANDAI;
	out.push(
		npc(
			"bandai",
			bx,
			by,
			NANASHI_WALK[3],
			talk("bandai", "down", (s) =>
				sayLines(s, "nanj", BANDAI.welcome, BANDAI.name),
			),
			{ dir: "down" },
		),
	);
	// 男湯の のれん（キリコは 入れない。番台に 止められて 1歩 もどる）
	const [nx, ny] = BATH_NOREN_M;
	out.push({
		id: "noren_m",
		x: nx,
		y: ny,
		trigger: "touch",
		through: true,
		run: async (s) => {
			s.face("bandai", "left");
			await s.say("nanj", BANDAI.stop, { name: BANDAI.name });
			s.face("bandai", "down");
			await s.move("player", "d");
		},
	});
	// 女湯
	for (const p of bathLayout(v, seed)) out.push(woman(p.who, p.at, p.place));
	// 男湯（仕切りの となり。壁ごしに 話す）
	const [a, b] = BATH_SPOTS.menSoak;
	const nanjHere = !awayFriends(v.cleared, v.stage).includes("nanj");
	out.push(
		nanjHere
			? npc(
					"bath_nanj",
					a.x,
					a.y,
					CAST.nanj.walk,
					talk("bath_nanj", a.dir, (s) => sayLines(s, "nanj", BATH_MEN.nanj)),
					{ who: "nanj", dir: a.dir },
				)
			: npc(
					"bath_nanashi",
					a.x,
					a.y,
					NANASHI_WALK[0],
					talk("bath_nanashi", a.dir, (s) =>
						sayLines(s, "nanj", BATH_MEN.nanashi, "名無し"),
					),
					{ dir: a.dir },
				),
	);
	if (stepOf(v) >= MOBS.jtleman.from)
		out.push(
			npc(
				"bath_jtleman",
				b.x,
				b.y,
				MOBS.jtleman.sprite,
				talk("bath_jtleman", b.dir, async (s) => {
					for (const l of BATH_MEN.jtleman) await sayAs(s, "jtleman", l);
				}),
				{ dir: b.dir },
			),
		);
	BATH_SPOTS.menBack.forEach((at, i) => {
		const id = `bath_back_${i}`;
		out.push(
			npc(
				id,
				at.x,
				at.y,
				NANASHI_WALK[1 + i],
				talk(id, at.dir, (s) => sayLines(s, "nanj", BATH_MEN.back, "名無し")),
				{ dir: at.dir },
			),
		);
	});
	// はじめて 湯に つかったとき（女湯の 湯の マスを 踏むと。銭湯に いるあいだ 1回）
	const taken = new Set(out.map((e) => `${e.x},${e.y}`));
	roomRows("bath").forEach((r, y) => {
		[...r].forEach((ch, x) => {
			if (ch !== "~" || x < BATH_WALL || taken.has(`${x},${y}`)) return;
			out.push({
				id: `soak_${x}_${y}`,
				x,
				y,
				trigger: "touch",
				through: true,
				when: (st) => !st.flags[SOAKED],
				run: async (s) => {
					s.set(SOAKED);
					await s.narrate(BATH_SOAK);
				},
			});
		});
	});
	return out;
};

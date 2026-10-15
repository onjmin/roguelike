// 町の 寄り道で 板を 見つける（data/town/finds.ts）。施設の 物・人の 文の あとに 1回だけ。
// 板が 開いたら その場で「〜に もぐれるように なった」と 知らせる（知らせ（news）は 積まない）。
// まだ 起きていない 出来事の 物・人には きらっと 光る 点を 出して 誘う（findGlint）。
// 同じ 点は 飾った 持ち帰り品（本館の 飾り棚・キリコの 家の 台）にも 出す（trophyGlint）。

import { DUNGEON_NAMES } from "../../data/story/story";
import { TOWN_FINDS, type TownFind } from "../../data/town/finds";
import { type Facility, facilityById } from "../../data/village/facilities";
import type { MapDef, Story } from "../../engine/defs";
import { loadProgress, loadTown, openByFlag } from "../../engine/save";
import { TILE } from "../../engine/types";

/** 起きる ところか（施設が 建ち、板が まだ 開いていない・前の 板が 開いている・町の 段）。 */
const ready = (f: TownFind): boolean => {
	const p = loadProgress();
	const stage = loadTown().stage;
	const fac = facilityById(f.facility);
	return (
		!!fac &&
		stage >= fac.from &&
		stage >= (f.stage ?? 0) &&
		!p.unlocked.includes(f.dungeon) &&
		(!f.after || p.unlocked.includes(f.after))
	);
};

/** 起きるたびに ふえる（光る 点を 消しなおす）。 */
let version = 0;

/** 起きたら true（遊べる 物は その回 遊ばない）。 */
export const townFind = async (
	s: Story,
	facility: string,
	at: string,
): Promise<boolean> => {
	const f = TOWN_FINDS.find((x) => x.facility === facility && x.at === at);
	if (!f || !ready(f)) return false;
	for (const l of f.lines)
		if (l.who) await s.say("nanj", l.text, { name: l.who });
		else await s.narrate(l.text);
	version++;
	if (!openByFlag(`town_${f.dungeon}`).includes(f.dungeon)) return true;
	s.se("chapter");
	await s.narrate(
		`「${DUNGEON_NAMES[f.dungeon].name}」に\nもぐれるように　なった`,
	);
	return true;
};

/** 光る 点の マス（lift：人の 頭の 上）。 */
type Glint = { x: number; y: number; lift: boolean };

/** 村の 地図：外に 置く 物（釣り場の 竿）。 */
const outdoorGlints = (): Glint[] =>
	TOWN_FINDS.filter(ready).flatMap((f) => {
		const t = facilityById(f.facility)?.outdoor?.find((x) => x.id === f.at);
		return t ? [{ x: t.at[0], y: t.at[1], lift: false }] : [];
	});

/** 施設の 中：調べる 物（同じ 物の いちばん 上・左の マス）と 話す 人。 */
const roomGlints = (fac: Facility): Glint[] =>
	TOWN_FINDS.filter((f) => f.facility === fac.id && ready(f)).flatMap(
		(f): Glint[] => {
			const room = fac.room;
			if (!room) return [];
			const who = room.people?.find((p) => p.id === f.at);
			if (who) return [{ x: who.at[0], y: who.at[1], lift: true }];
			for (const [y, r] of room.rows.entries()) {
				const x = [...r].findIndex((ch) => room.things[ch] === f.at);
				if (x >= 0) return [{ x, y, lift: false }];
			}
			return [];
		},
	);

/**
 * きらっと 光る 点（4方向の 光の すじが のびて 縮む → しばらく 消える）。
 * 1マスに 2つ、半周期 ずらして 出す（大きい 点と 小さい 点）。
 */
const sparkle = (
	g: CanvasRenderingContext2D,
	cx: number,
	cy: number,
	t: number,
	big: boolean,
): void => {
	const frame = Math.floor((t % 1400) / 110);
	// 0〜6 で 光り、のこりは 消えて いる
	const arm = [0, 1, 2, 4, 3, 1, 0][frame];
	if (arm === undefined) return;
	const n = big ? arm : Math.min(arm, 2);
	// 明るい 床（突堤・畳）でも 見えるよう、すじの 先は 琥珀色、根もとは 白
	for (let i = 1; i <= n; i++) {
		g.fillStyle = i === n && n >= 2 ? "rgba(255, 196, 64, 0.95)" : "#ffffff";
		g.fillRect(cx - i, cy, 1, 1);
		g.fillRect(cx + i, cy, 1, 1);
		g.fillRect(cx, cy - i, 1, 1);
		g.fillRect(cx, cy + i, 1, 1);
	}
	if (big && n >= 2) {
		g.fillStyle = "rgba(255, 210, 90, 0.8)";
		g.fillRect(cx - 1, cy - 1, 1, 1);
		g.fillRect(cx + 1, cy - 1, 1, 1);
		g.fillRect(cx - 1, cy + 1, 1, 1);
		g.fillRect(cx + 1, cy + 1, 1, 1);
	}
	g.fillStyle = "#ffffff";
	g.fillRect(cx, cy, 1, 1);
};

/** 1マス（左上 px, py）に 大きい 点と 小さい 点を 半周期 ずらして 光らせる。 */
export const cellGlint = (
	g: CanvasRenderingContext2D,
	px: number,
	py: number,
	t: number,
): void => {
	sparkle(g, px + 12, py + 3, t, true);
	sparkle(g, px + 4, py + 9, t + 700, false);
};

/** 飾った 品の 光る 点（並びの i 番目。いっせいに 光らないよう 時を ずらす）。 */
export const trophyGlint = (
	g: CanvasRenderingContext2D,
	px: number,
	py: number,
	t: number,
	i: number,
): void => cellGlint(g, px, py, t + i * 530);

const glintDecor = (cellsOf: () => Glint[]): MapDef["decor"] => {
	let seen = -1;
	let cells: Glint[] = [];
	return (g, ox, oy, t) => {
		if (seen !== version) {
			seen = version;
			cells = cellsOf();
		}
		for (const c of cells) {
			const px = c.x * TILE - ox;
			const py = c.y * TILE - oy - (c.lift ? TILE : 0);
			cellGlint(g, px, py, t);
		}
	};
};

/** 村の 地図の 光る 点（ui/village/villageEvents.ts の 飾り）。 */
export const villageFindGlint = (): MapDef["decor"] =>
	glintDecor(outdoorGlints);

/** 施設の 中の 光る 点（ui/village/facilities.ts の 飾り）。 */
export const roomFindGlint = (fac: Facility): MapDef["decor"] =>
	glintDecor(() => roomGlints(fac));

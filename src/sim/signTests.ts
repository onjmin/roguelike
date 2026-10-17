// 建物の 看板（ui/village/signboards.ts）が 電光表示（ui/village/displays.ts・ui/trade/stockBoardDecor.ts）や
// 煙突の 湯気（ui/minigames/bath.ts）に かぶらない ことの 試験（pnpm test で いっしょに 動く）。

import { TOWN_STAGES } from "../core/town";
import { facilitiesAt } from "../data/village/facilities";
import { villageRows } from "../data/village/map";
import { TILE } from "../engine/types";
import { boardCell } from "../ui/trade/stockBoardDecor";
import { faceRect, outsideDisplayRects } from "../ui/village/displays";
import { coreSignRects, facilitySignRects } from "../ui/village/signboards";
import type { TestResult } from "./monsterTests";

class Fail extends Error {}
const ok = (cond: unknown, why: string): void => {
	if (!cond) throw new Fail(why);
};

type Rect = { x0: number; y0: number; x1: number; y1: number };
const hit = (a: Rect, b: Rect): boolean =>
	a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

const STAGES = [...Array(TOWN_STAGES).keys()];

const CASES: { name: string; run: () => void }[] = [];
const test = (name: string, run: () => void) => CASES.push({ name, run });

test("no facade sign covers a display or the stock ticker", () => {
	for (const stage of STAGES) {
		const screens = [
			...outsideDisplayRects(stage),
			...facilitiesAt(stage).flatMap((f) => {
				if (f.look.kind !== "grid") return [];
				const c = boardCell(f.look.rows);
				return c && f.id === "shoken"
					? [
							{
								facility: f.id,
								...faceRect([f.at[0] + c[0], f.at[1] + c[1]], 4, "led"),
							},
						]
					: [];
			}),
		];
		for (const sign of facilitySignRects(stage))
			for (const d of screens)
				ok(
					!hit(sign, d),
					`stage ${stage}: the ${sign.facility} sign covers the ${d.facility} display`,
				);
	}
});

test("no sign hangs in a chimney or its steam", () => {
	for (const stage of STAGES) {
		const rows = villageRows({ stage, unlocked: [], cleared: [] });
		const chimneys: Rect[] = [];
		rows.forEach((r, y) => {
			[...r].forEach((ch, x) => {
				// 煙突の マスと 湯気の 立つ 上の 3マス
				if (ch === "Ц")
					chimneys.push({
						x0: x * TILE - 4,
						x1: (x + 1) * TILE + 4,
						y0: (y - 3) * TILE,
						y1: (y + 1) * TILE,
					});
			});
		});
		for (const sign of coreSignRects(stage))
			for (const c of chimneys)
				ok(!hit(sign, c), `stage ${stage}: ${sign.place} is in the chimney`);
	}
});

export const runSignTests = (): TestResult[] =>
	CASES.map((c) => {
		try {
			c.run();
			return { id: "sign", name: c.name, ok: true };
		} catch (e) {
			return {
				id: "sign",
				name: c.name,
				ok: false,
				reason: e instanceof Error ? e.message : String(e),
			};
		}
	});

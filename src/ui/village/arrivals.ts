// 越してくる 住人の 場面を 演じる（文と きっかけは data/story/arrivals.ts）。見た 場面は 別の 保存場所に 残す
// （保存できなくても この回は 覚えている）。見おえるまで その 子は 町に いない（data/people/mobs.ts の setIntroSeen）。
// 町を 1歩 歩いた あと（ui/village/village.ts の afterStep）に、場所の 寸劇より 先に 見る。

import { MOBS, type MobId, setIntroSeen } from "../../data/people/mobs";
import { ARRIVALS, type Arrival } from "../../data/story/arrivals";
import { type Cell, spotsAround } from "../../data/village/map";
import type { Story } from "../../engine/defs";
import { cueOf } from "../../engine/emote";
import { loadProgress, loadRecords } from "../../engine/save";
import { type FxRun, fxRoot, startFx } from "../../engine/sceneFx";
import { skitsHeld } from "./skits";
import { sayAs } from "./villageMobs";
import { villageView } from "./villageReturn";

const KEY = "kiriko-roguelike/arrivals";

let memo: string[] = [];

const load = (): string[] => {
	try {
		const raw = localStorage.getItem(KEY);
		if (raw) {
			const o = JSON.parse(raw) as unknown;
			if (Array.isArray(o))
				return o.filter((x): x is string => typeof x === "string");
		}
	} catch {
		// 読めなければ この回の 写し
	}
	return [...memo];
};

const save = (v: string[]): void => {
	memo = [...v];
	try {
		localStorage.setItem(KEY, JSON.stringify(v));
	} catch {
		// 保存できなくても 遊べる
	}
};

/** 試験用：この回の 写しを 忘れる。 */
export const forgetArrivals = (): void => {
	memo = [];
};

setIntroSeen((key) => load().includes(key));

/** いま 起きる 場面（無ければ null。歩く たびに 呼ぶので 見るだけ）。まだ 1度も 帰って いない 村では 起きない。 */
export const dueArrival = (map: string): Arrival | null => {
	if (map !== "village" || skitsHeld() || !loadRecords()[0]) return null;
	const seen = load();
	const cleared = loadProgress().cleared;
	return (
		ARRIVALS.find((a) => !seen.includes(a.key) && cleared.includes(a.after)) ??
		null
	);
};

/** 向かい合う 向き（from から to を 見る）。 */
const toward = (from: Cell, to: Cell): "left" | "right" | "up" | "down" => {
	const dx = to[0] - from[0];
	const dy = to[1] - from[1];
	return Math.abs(dx) >= Math.abs(dy)
		? dx < 0
			? "left"
			: "right"
		: dy < 0
			? "up"
			: "down";
};

/** 演じる：暗転の 中で 町に 出して、少し 離れた 所から キリコの そばへ 歩かせ、話の あと 持ち場へ。 */
export const playArrival = async (s: Story, a: Arrival): Promise<void> => {
	save([...load(), a.key]);
	const ids: readonly MobId[] = a.mobs;
	await s.fadeOut(300);
	await s.rebuild();
	const me: Cell = [s.state.x, s.state.y];
	const ring = spotsAround(villageView(), 40, me);
	const talk = ring.slice(0, ids.length);
	const from = ring.slice(-ids.length).reverse();
	ids.forEach((id, i) => {
		const at = from[i] ?? MOBS[id].spot;
		s.place(`mob_${id}`, at[0], at[1], toward(at, me));
	});
	await s.fadeIn(300);
	await Promise.all(
		ids.map((id, i) => {
			const to = talk[i];
			return to ? s.goto(`mob_${id}`, to[0], to[1]) : Promise.resolve();
		}),
	);
	ids.forEach((id) => {
		s.face(`mob_${id}`, "player");
	});
	if (talk[0]) s.face("player", toward(me, talk[0]));
	await s.look(null);
	let fx: FxRun | null = null;
	try {
		for (const l of a.lines) {
			if (l.calm && fx) {
				fx.end();
				fx = null;
			}
			if (l.fx) {
				fx?.end();
				if (l.fx === "boom") s.se("explosion");
				fx = startFx(fxRoot(), l.fx);
				await fx.ready;
			}
			const cue = cueOf(l);
			if (l.who === null) await s.narrate(l.text);
			else if (l.who === "kiriko") await s.kiriko(l.text, "voice", cue);
			else await sayAs(s, l.who, l.text, cue);
		}
	} finally {
		fx?.end();
	}
	// 持ち場へ（遠ければ 画面の 外を とばす）
	await s.wait(200);
	await Promise.all(
		ids.map((id) => {
			const [x, y] = MOBS[id].spot;
			return s.goto(`mob_${id}`, x, y);
		}),
	);
	ids.forEach((id) => {
		s.face(`mob_${id}`, MOBS[id].dir);
	});
};

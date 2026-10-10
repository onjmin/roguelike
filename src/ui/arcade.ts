// 施設の 台の 遊び（ゲームセンター「連コ」の 筐体・カジノ「ガチャ」の 台・海の家・バー。1台に 1つずつ 別の ゲーム。data/arcade/types.ts）の 窓の がわ。
// 部屋の 物（data/village/facilities.ts の plays が "arcade"）を 調べると ui/facilities.ts が arcadePlay を 呼ぶ：
// 物の 文 → ハイスコア（あれば）→「遊ぶ／やめる」→ はじめての 台は 決まり → 板（ui/arcadeAction.ts・ui/arcadeTiming.ts）
// → スコア（ハイスコアを こえたら ひとこと）。板は ui/arcadeParlor.ts も（カジノ・海の家・バー）。B で やめたら「途中で　席を　立った」だけ（記録しない）。
// どれも 寄り道で、強さ・道具・売上・町の 段には 何も 効かない。見た目の 乱数は Math.random。
// 記録は localStorage の kiriko-roguelike/arcade だけ（?stage= ・?event= の ときは 書かない。memo には 残る）。
// 試験は setArcadeHooks で 板の かわりに 結果を わたす（src/sim/arcadeTests.ts）。

import { ARCADE, ARCADE_TEXT } from "../data/arcade/text";
import {
	ARCADE_GAMES,
	type ArcadeGame,
	isArcadeGame,
} from "../data/arcade/types";
import { devEvent } from "../data/objectives";
import type { Story } from "../engine/defs";
import {
	playBreakout,
	playDrive,
	playRunner,
	playShooter,
} from "./arcadeAction";
import type { ArcadeResult } from "./arcadeKit";
import {
	playGacha,
	playGlassSlide,
	playHighLow,
	playRoulette,
	playSuika,
} from "./arcadeParlor";
import { playFighter, playMole, playRhythm, playSlot } from "./arcadeTiming";
import type { UiCtx } from "./list";
import { previewStage } from "./villageReturn";
import { fill } from "./villageTalk";

export { isArcadeGame };

// ───────────────── 記録 ─────────────────

const KEY = "kiriko-roguelike/arcade";

/** best＝ハイスコア、plays＝遊んだ 回数（さいごまで）、tutored＝決まりを 読んだ 台。 */
export type ArcadeMemo = {
	v: 1;
	best: Record<ArcadeGame, number>;
	plays: Record<ArcadeGame, number>;
	tutored: ArcadeGame[];
};

const zeros = (): Record<ArcadeGame, number> =>
	Object.fromEntries(ARCADE_GAMES.map((g) => [g, 0])) as Record<
		ArcadeGame,
		number
	>;

const fresh = (): ArcadeMemo => ({
	v: 1,
	best: zeros(),
	plays: zeros(),
	tutored: [],
});

let memo: ArcadeMemo | null = null;

const previewing = (): boolean =>
	previewStage() !== null || devEvent() !== null;

/** スコアの 上限（こわれた 値や 大きすぎる 値は 丸める）。 */
export const ARCADE_SCORE_MAX = 9_999_999;

const nat = (v: unknown): number =>
	typeof v === "number" && Number.isFinite(v) && v >= 0
		? Math.min(ARCADE_SCORE_MAX, Math.floor(v))
		: 0;
const obj = (v: unknown): Record<string, unknown> =>
	v && typeof v === "object" ? (v as Record<string, unknown>) : {};

/** 読む（こわれた 所は はじめの 値に）。 */
export const loadArcade = (): ArcadeMemo => {
	if (memo) return structuredClone(memo);
	const m = fresh();
	try {
		const raw = obj(JSON.parse(localStorage.getItem(KEY) ?? "null"));
		if (raw.v === 1) {
			const best = obj(raw.best);
			const plays = obj(raw.plays);
			for (const g of ARCADE_GAMES) {
				m.best[g] = nat(best[g]);
				m.plays[g] = nat(plays[g]);
			}
			if (Array.isArray(raw.tutored))
				m.tutored = ARCADE_GAMES.filter((g) =>
					(raw.tutored as unknown[]).includes(g),
				);
		}
	} catch {
		// 読めない ときは はじめから
	}
	memo = m;
	return structuredClone(m);
};

/** 書く（開発の ?stage= ・?event= では 書かない。memo には 残す）。 */
export const saveArcade = (m: ArcadeMemo, noSave = previewing()): void => {
	memo = structuredClone(m);
	if (noSave) return;
	try {
		localStorage.setItem(KEY, JSON.stringify(m));
	} catch {
		// 保存できなくても この回は memo で 覚えている
	}
};

/** 試験用：memo を 忘れる。 */
export const forgetArcadeMemo = (): void => {
	memo = null;
};

// ───────────────── 試験の 差しこみ口 ─────────────────

export type ArcadeHooks = Partial<
	Record<ArcadeGame, () => Promise<ArcadeResult | null>>
>;
let hooks: ArcadeHooks | null = null;
/** 試験用：板を 出さずに 結果を わたす（null で もとに もどす）。 */
export const setArcadeHooks = (h: ArcadeHooks | null): void => {
	hooks = h;
};

// ───────────────── 窓の がわ ─────────────────

const BOARDS: Record<ArcadeGame, (ctx: UiCtx) => Promise<ArcadeResult | null>> =
	{
		shooter: playShooter,
		drive: playDrive,
		breakout: playBreakout,
		mole: playMole,
		fighter: playFighter,
		slot: playSlot,
		runner: playRunner,
		rhythm: playRhythm,
		gacha: playGacha,
		highlow: playHighLow,
		roulette: playRoulette,
		suika: playSuika,
		glassSlide: playGlassSlide,
	};

/** 筐体を 調べた あと（物の 文は ui/facilities.ts が 先に 読む）。 */
export const arcadeScript = async (
	ctx: UiCtx,
	s: Story,
	game: ArcadeGame,
): Promise<void> => {
	const t = ARCADE_TEXT[game];
	const m = loadArcade();
	if (m.best[game] > 0)
		await s.narrate(fill(ARCADE.record, { best: m.best[game], unit: t.unit }));
	if ((await s.choose([...ARCADE.menu], { cancel: 1 })) !== 0) return;
	if (!m.tutored.includes(game)) {
		await s.narrate(t.rule);
		m.tutored.push(game);
		saveArcade(m);
	}
	await s.wait(0);
	const play = hooks?.[game] ?? (() => BOARDS[game](ctx));
	const r = await play();
	if (!r) {
		await s.narrate(ARCADE.quit);
		return;
	}
	const score = nat(r.score);
	const beat = score > m.best[game];
	if (beat) m.best[game] = score;
	m.plays[game]++;
	saveArcade(m);
	await s.narrate(fill(ARCADE.after, { score, unit: t.unit }));
	if (beat) {
		ctx.se("arcBest");
		await s.narrate(ARCADE.newBest);
	}
};

/** 部屋の 物から（物の 名前が ゲームの 名前。知らない 名前なら 何もしない）。 */
export const arcadePlay = async (
	ctx: UiCtx,
	s: Story,
	kind: string,
): Promise<void> => {
	if (isArcadeGame(kind)) await arcadeScript(ctx, s, kind);
};

// 開発用（pnpm dev の とき だけ。本番の ?debug では 出ない）：__arcade("shooter") で 板だけ
if (import.meta.env.DEV && typeof window !== "undefined")
	Object.assign(window, {
		__arcade: (game: ArcadeGame) => {
			const ctx = (window as unknown as { __village?: { ctx?: UiCtx } })
				.__village?.ctx;
			if (!ctx) throw new Error("__arcade: no village");
			return BOARDS[game](ctx);
		},
	});

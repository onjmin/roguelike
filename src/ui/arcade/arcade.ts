// 施設の 台の 遊び（ゲームセンター「連コ」の 筐体・カジノ「ガチャ」の 台・海の家・バー。1台に 1つずつ 別の ゲーム。data/arcade/types.ts）の 窓の がわ。
// 部屋の 物（data/village/facilities.ts の plays が "arcade"）を 調べると ui/village/facilities.ts が arcadePlay を 呼ぶ：
// 物の 文 → ハイスコア（あれば）→「遊ぶ／やめる」→ はじめての 台は 決まり → 板（ui/arcade/arcadeAction.ts・ui/arcade/arcadeTiming.ts）
// → スコア（ハイスコアを こえたら ひとこと）→「もう一回／やめる」（もう一回は 同じ 曲・同じ 枚数で すぐ。毎回 払う）。板は ui/arcade/arcadeParlor.ts も（カジノ・海の家・バー）。B で やめたら「途中で　席を　立った」だけ（記録しない）。
// どれも 寄り道で、強さ・道具・売上・町の 段には 何も 効かない。見た目の 乱数は Math.random。
// カジノの 台は 財布の お金で チップを 買って 遊び、席を 立つと 換金する（ui/arcade/casinoChips.ts。
// 2026-10-14 作者：「お金を 賭けない 方針は 撤廃」。前は 店が 貸す 遊びの チップだった）。
// 記録は localStorage の kiriko-roguelike/arcade だけ（?stage= ・?event= の ときは 書かない。memo には 残る）。
// 試験は setArcadeHooks で 板の かわりに 結果を わたす（src/sim/arcadeTests.ts）。

import { CASINO, casinoKind, isCasinoGame } from "../../data/arcade/casino";
import { ARCADE, ARCADE_PLAY_YEN, ARCADE_TEXT } from "../../data/arcade/text";
import {
	ARCADE_GAMES,
	ARCADE_HOME,
	type ArcadeGame,
	isArcadeGame,
} from "../../data/arcade/types";
import { devEvent } from "../../data/story/objectives";
import type { Story } from "../../engine/defs";
import { spendYen, walletYen, yen } from "../../engine/wallet";
import type { UiCtx } from "../list";
import { playOrRecord } from "../minigames/playMenu";
import { craneGift } from "../village/myhome";
import { previewStage } from "../village/villageReturn";
import { fill } from "../village/villageTalk";
import {
	playBreakout,
	playDrive,
	playRunner,
	playShooter,
} from "./arcadeAction";
import { playBomber, playPlatform } from "./arcadeHome";
import type { ArcadeResult } from "./arcadeKit";
import {
	playGacha,
	playGlassSlide,
	playHighLow,
	playRoulette,
	playSuika,
} from "./arcadeParlor";
import { playFighter, playMole, playRhythm, playSlot } from "./arcadeTiming";
import { buyChips, cashOut, casinoBuy, casinoMenu } from "./casinoChips";
import { playBaccarat } from "./home/baccarat";
import { playBlackjack } from "./home/blackjack";
import { playClicker } from "./home/clicker";
import { craneLastWins, playCrane } from "./home/crane";
import { playCrossing } from "./home/crossing";
import { playDanmaku } from "./home/danmaku";
import { playDarts } from "./home/darts";
import { playDigkiriko } from "./home/digkiriko";
import { playDoom } from "./home/doom";
import { playGomoku } from "./home/gomoku";
import { playGrass } from "./home/grass";
import { playHasami } from "./home/hasami";
import { playKingyo } from "./home/kingyo";
import { playKoikoi } from "./home/koikoi";
import { playKurohige } from "./home/kurohige";
import { playMikiri } from "./home/mikiri";
import { playMines } from "./home/mines";
import { playMojisagashi } from "./home/mojisagashi";
import { playNineball } from "./home/nineball";
import { playPachinko } from "./home/pachinko";
import { playPatapata } from "./home/patapata";
import { playPicross } from "./home/picross";
import { playPinball } from "./home/pinball";
import { playPoker } from "./home/poker";
import { playPong } from "./home/pong";
import { playPuyupuyu } from "./home/puyupuyu";
import { playResukui } from "./home/resukui";
import { playReversi } from "./home/reversi";
import { playSimon } from "./home/simon";
import { playSnake } from "./home/snake";
import { playSoko } from "./home/soko";
import { playStack } from "./home/stack";
import { playTaiko } from "./home/taiko";
import { playTsuribori } from "./home/tsuribori";
import { playWangan } from "./home/wangan";
import { replaySong } from "./songPlay";

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
	Record<ArcadeGame, (stake?: number) => Promise<ArcadeResult | null>>
>;
let hooks: ArcadeHooks | null = null;
/** 試験用：板を 出さずに 結果を わたす（null で もとに もどす）。 */
export const setArcadeHooks = (h: ArcadeHooks | null): void => {
	hooks = h;
};

// ───────────────── 窓の がわ ─────────────────

/** stake は カジノの 台の はじめの チップ（玉）。ほかの 台は 見ない。 */
const BOARDS: Record<
	ArcadeGame,
	(ctx: UiCtx, stake?: number) => Promise<ArcadeResult | null>
> = {
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
	platform: playPlatform,
	bomber: playBomber,
	snake: playSnake,
	stack: playStack,
	crossing: playCrossing,
	gomoku: playGomoku,
	hasami: playHasami,
	mines: playMines,
	grass: playGrass,
	taiko: playTaiko,
	simon: playSimon,
	pong: playPong,
	kurohige: playKurohige,
	kingyo: playKingyo,
	puyupuyu: playPuyupuyu,
	pinball: playPinball,
	danmaku: playDanmaku,
	mikiri: playMikiri,
	mojisagashi: playMojisagashi,
	clicker: playClicker,
	doom: playDoom,
	wangan: playWangan,
	crane: playCrane,
	resukui: playResukui,
	digkiriko: playDigkiriko,
	patapata: playPatapata,
	reversi: playReversi,
	koikoi: playKoikoi,
	picross: playPicross,
	soko: playSoko,
	nineball: playNineball,
	darts: playDarts,
	tsuribori: playTsuribori,
	poker: playPoker,
	blackjack: playBlackjack,
	baccarat: playBaccarat,
	pachinko: playPachinko,
};

/** 筐体を 調べた あと（物の 文は ui/village/facilities.ts が 先に 読む）。 */
export const arcadeScript = async (
	ctx: UiCtx,
	s: Story,
	game: ArcadeGame,
): Promise<void> => {
	const t = ARCADE_TEXT[game];
	const m = loadArcade();
	const record =
		m.best[game] > 0
			? [fill(ARCADE.record, { best: m.best[game], unit: t.unit })]
			: [];
	// ゲームセンターの 筐体・海の家の スイカ割り・バーの グラス滑らせは 1回 ARCADE_PLAY_YEN 円
	// （財布から。足りなければ 遊べない。途中で やめても もどらない）。カジノは チップを 買う（ui/arcade/casinoChips.ts）
	const paid = ["arcade", "umi", "bar"].includes(ARCADE_HOME[game]);
	const price = yen(ARCADE_PLAY_YEN);
	const casino = isCasinoGame(game);
	const menu = casino
		? casinoMenu(game)
		: paid
			? ARCADE.payMenu.map((x) => fill(x, { price }))
			: ARCADE.menu;
	if ((await playOrRecord(s, record, menu)) === null) return;
	const stake = casino ? await buyChips(ctx, s, game, previewing()) : null;
	if (casino && stake === null) return;
	if (paid && !spendYen(ARCADE_PLAY_YEN, previewing())) {
		await s.narrate(fill(ARCADE.short, { price, have: yen(walletYen()) }));
		return;
	}
	if (paid) ctx.se("arcCoin");
	if (!m.tutored.includes(game)) {
		await s.narrate(t.rule);
		m.tutored.push(game);
		saveArcade(m);
	}
	// おわったら「もう一回／やめる」（はじめが もう一回。台を 調べなおさずに 同じ 曲・同じ 枚数で すぐ また 遊ぶ。
	// 値段は 毎回 払う。払えない ときは 聞かない）。B で 途中で やめたら 聞かない
	for (let again = false; ; again = true) {
		await s.wait(0);
		replaySong(again);
		const play = hooks?.[game] ?? ((n?: number) => BOARDS[game](ctx, n));
		const r = await play(stake ?? undefined).finally(() => replaySong(false));
		if (!r) {
			await s.narrate(ARCADE.quit);
			if (stake !== null) await cashOut(s, game, stake, 0, previewing());
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
		// カジノは 手もとの チップ（玉）を 換金（板が cash を 返さなければ スコアを 手もとと みる）
		if (stake !== null)
			await cashOut(s, game, stake, r.cash ?? r.score, previewing());
		// クレーンゲームで 金の ぷゆゆを とったら、家に ぬいぐるみの 家具が 届く（家を 買って いて、まだ 持って いなければ）
		if (game === "crane" && !hooks && craneLastWins().includes("puyuGold"))
			await craneGift(s);
		const cost =
			stake !== null
				? stake * CASINO[casinoKind(game)].rate
				: paid
					? ARCADE_PLAY_YEN
					: 0;
		if (walletYen() < cost) return;
		const opts =
			stake !== null
				? [fill(CASINO[casinoKind(game)].again, { n: stake }), ARCADE.again[1]]
				: paid
					? ARCADE.payAgain.map((x) => fill(x, { price }))
					: [...ARCADE.again];
		if ((await s.choose(opts, { cancel: 1 })) !== 0) return;
		if (
			stake !== null
				? !casinoBuy(game, stake, previewing())
				: !spendYen(cost, previewing())
		)
			return;
		if (cost > 0) ctx.se("arcCoin");
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

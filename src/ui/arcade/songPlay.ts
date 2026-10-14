// 音ゲーの 曲（ゲームセンターの「おんJビート」・キリコの 家の「おんJ太鼓」）。譜面は data/arcade/songChart.ts。
// - 曲は 町で 聞いた 曲（広場の 蓄音機で かけられる 曲と 同じ。data/audio/music.ts の records）から えらぶ。
// - MML は dtm の parseMML で 音符に 読みかえる（dtm は 重いので 要る ときに 読む。engine/audio.ts と 同じ 物）。
// - 時計は 曲の 鳴っている 位置（engine/audio.ts の playChartSong）。押した 時刻も 曲の 秒に なおして 判定する。
//   音が 出せない（ミュート・BGM 切）ときは 板の 時計で 回す（札は 同じ）。
// - おわったら 曲を 絞って 止め、もとの 曲に もどす。
// - 曲ごとの ハイスコアは localStorage の kiriko-roguelike/arcade-songs（?stage= ・?event= の ときは 書かない）。

import {
	type ChartOpts,
	type SongChart,
	songChart,
} from "../../data/arcade/songChart";
import { records } from "../../data/audio/music";
import { devEvent } from "../../data/story/objectives";
import type { GameAudio } from "../../engine/audio";
import { loadProgress, loadTown } from "../../engine/save";
import { listWindow, type UiCtx } from "../list";
import { previewStage } from "../village/villageReturn";

const KEY = "kiriko-roguelike/arcade-songs";

/** 曲の 読みこみを 待つ あいだの 板の 下の 字。 */
export const SONG_LOADING = "曲を　読みこみ中……";

export type SongGame = "rhythm" | "taiko";

/** 曲ごとの ハイスコア（キーは「ゲーム:曲」）。 */
const loadBests = (): Record<string, number> => {
	try {
		const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as unknown;
		if (!raw || typeof raw !== "object") return {};
		const out: Record<string, number> = {};
		for (const [k, v] of Object.entries(raw))
			if (typeof v === "number" && Number.isFinite(v) && v >= 0)
				out[k] = Math.floor(v);
		return out;
	} catch {
		return {};
	}
};

export const songBest = (game: SongGame, bgm: string): number =>
	loadBests()[`${game}:${bgm}`] ?? 0;

export const saveSongBest = (game: SongGame, bgm: string, score: number) => {
	if (previewStage() !== null || devEvent() !== null) return;
	const b = loadBests();
	const k = `${game}:${bgm}`;
	if (score <= (b[k] ?? 0)) return;
	b[k] = score;
	try {
		localStorage.setItem(KEY, JSON.stringify(b));
	} catch {
		// 保存できなくても 遊べる
	}
};

const audioOf = (ctx: UiCtx): GameAudio | null =>
	"audio" in ctx ? ((ctx as { audio: GameAudio }).audio ?? null) : null;

/** 譜面の 細かさ（1秒 あたりの 札）を ★ 1〜5 に。 */
const stars = (c: SongChart): string => {
	const nps = c.notes.length / Math.max(1, c.endSec);
	const n = Math.max(1, Math.min(5, Math.round(nps * 1.4 - 0.6)));
	return "★".repeat(n) + "☆".repeat(5 - n);
};

const cache = new Map<string, SongChart | null>();

/** 曲の 譜面（作れなければ null）。 */
export const chartOf = async (
	bgmData: Record<string, string>,
	bgm: string,
	opts: ChartOpts,
): Promise<SongChart | null> => {
	const key = `${bgm}:${opts.lanes}:${opts.taiko ? 1 : 0}`;
	if (cache.has(key)) return cache.get(key) ?? null;
	const mml = bgmData[bgm];
	let c: SongChart | null = null;
	if (mml)
		try {
			const { parseMML } = await import("@onjmin/dtm");
			const p = parseMML(mml);
			c = songChart(p.placements, p.bpm ?? 120, opts);
		} catch (e) {
			console.warn("[arcade] 譜面を 作れませんでした", bgm, e);
		}
	cache.set(key, c);
	return c;
};

export type PickedSong = { bgm: string; label: string; chart: SongChart };

/** 曲を えらぶ（町で 聞いた 曲。やめたら null）。 */
export const pickSong = async (
	ctx: UiCtx,
	game: SongGame,
	opts: ChartOpts,
): Promise<PickedSong | null> => {
	const { bgm: bgmData } = await import("../../data/audio/bgm");
	const list = records(loadTown().stage, loadProgress().cleared);
	const ok: PickedSong[] = [];
	for (const r of list) {
		const chart = await chartOf(bgmData, r.bgm, opts);
		if (chart && chart.notes.length >= 16) ok.push({ ...r, chart });
	}
	if (!ok.length) return null;
	const v = await listWindow(
		ctx,
		"どの　曲で　遊ぶ？",
		ok.map((r) => {
			const best = songBest(game, r.bgm);
			return {
				label: r.label,
				sub: `${stars(r.chart)}${best ? `　${best}` : ""}`,
				value: r.bgm,
			};
		}),
		{ closeLabel: "やめる" },
	);
	return ok.find((r) => r.bgm === v) ?? null;
};

export type SongClock = {
	/** 曲の 秒（鳴りはじめる 前は 0。音が 出ない ときは 板の 時計）。 */
	now: (boardClock: number) => number;
	/** 押した 時刻（performance.now）→ 曲の 秒。 */
	at: (pressed: number, boardClock: number) => number;
	/** 鳴りはじめを 待って いる（読みこみ中）。 */
	waiting: () => boolean;
	stop: () => Promise<void>;
};

/** 曲を 鳴らして 時計に する（板の はじめの こまで 呼ぶ）。 */
export const startSong = (ctx: UiCtx, song: PickedSong): SongClock => {
	const audio = audioOf(ctx);
	const prev = audio?.currentBgm ?? null;
	let play: { step: () => number; stop: () => void } | null = null;
	let silent = !audio;
	let silentFrom = 0;
	let done = false;
	if (audio)
		void audio.playChartSong(song.bgm, song.chart.fromStep).then((p) => {
			if (done) {
				p?.stop();
				return;
			}
			play = p;
			if (!p) silent = true;
		});
	// 曲の 秒は 鳴らした 時刻では なく 聞こえる 時刻で 数える（Bluetooth の イヤホンだと 0.2秒ほど
	// 遅れて 聞こえ、音に 合わせて 押すと ぜんぶ「早い」に なった）。譜面の 絵も これで 動くので 音と そろう
	const songSec = (): number =>
		play
			? Math.max(
					0,
					(play.step() - song.chart.fromStep) * song.chart.sps -
						(audio?.outputLatencySec() ?? 0),
				)
			: 0;
	return {
		now: (clock) => {
			if (silent) {
				if (!silentFrom) silentFrom = clock || 1e-6;
				return Math.max(0, clock - silentFrom);
			}
			return songSec();
		},
		at: (pressed, clock) => {
			const late = Math.max(0, (performance.now() - pressed) / 1000);
			if (silent) return Math.max(0, clock - silentFrom - late);
			return Math.max(0, songSec() - late);
		},
		waiting: () => !silent && songSec() === 0,
		stop: async () => {
			done = true;
			if (audio && play) {
				await audio.fadeBgm(600);
				play.stop();
			}
			if (audio) audio.bgm(prev);
		},
	};
};

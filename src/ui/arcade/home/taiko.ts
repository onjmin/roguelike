// キリコの 家の 太鼓「おんJ太鼓」。町で 聞いた 曲を えらび、その 曲の 旋律から 作った 譜面で たたく
// （譜面は data/arcade/songChart.ts の TAIKO_OPTS、曲と 時計は ui/arcade/songPlay.ts）。
// - 札は 右から 左の 判定の 輪へ 流れる。赤＝ドン（A・↓、左半分の タップ）、青＝カッ（←→・↑、右半分の タップ）。
// - 判定・点・コンボは 音ゲー「おんJビート」と 同じ（data/arcade/logic.ts の rhStep。道 0 が ドン、1 が カッ）。

import { AH, AW, rhStart, rhStep } from "../../../data/arcade/logic";
import { TAIKO_OPTS } from "../../../data/arcade/songChart";
import { ARCADE, ARCADE_BOARD } from "../../../data/arcade/text";
import type { UiCtx } from "../../list";
import { txt } from "../../neta/netaBoard";
import { fill } from "../../village/villageTalk";
import { type ArcadeResult, hud, isKey, isTap, playBoard } from "../arcadeKit";
import {
	pickSong,
	SONG_LOADING,
	type SongClock,
	saveSongBest,
	startSong,
} from "../songPlay";

/** 判定の 輪の まんなか。 */
const JX = 46;
const JY = 82;
/** 札の 流れる 速さ（px／秒）。 */
const SPEED = 120;
const DON = "#e04830";
const KA = "#3c8ce0";

export const playTaiko = async (ctx: UiCtx): Promise<ArcadeResult | null> => {
	const song = await pickSong(ctx, "taiko", TAIKO_OPTS);
	if (!song) return null;
	let judge = "";
	let judgeT = 0;
	/** たたいた 光（0 ドン・1 カッ）。 */
	const lit = [0, 0];
	let clock: SongClock | null = null;
	let loading = false;
	const r = await playBoard(ctx, "taiko", {
		songClock: true,
		start: () => rhStart(song.chart),
		note: song.label,
		step: (s, f) => {
			clock ??= startSong(ctx, song);
			const now = clock.now(f.clock);
			const wait = clock.waiting() && f.clock > 0.4;
			if (wait !== loading) f.say(wait ? SONG_LOADING : song.label);
			loading = wait;
			const hits: { lane: number; at: number }[] = [];
			for (const e of f.evs) {
				const at = clock.at(e.at, f.clock);
				if (isKey(e, "a") || isKey(e, "down")) hits.push({ lane: 0, at });
				else if (isKey(e, "left") || isKey(e, "right") || isKey(e, "up"))
					hits.push({ lane: 1, at });
				else if (isTap(e)) hits.push({ lane: e.tap[0] < AW / 2 ? 0 : 1, at });
			}
			for (const h of hits) {
				lit[h.lane] = 0.12;
				f.se(h.lane === 0 ? "arcBlock" : "cursor");
			}
			for (let i = 0; i < lit.length; i++)
				lit[i] = Math.max(0, (lit[i] ?? 0) - f.dt);
			judgeT = Math.max(0, judgeT - f.dt);
			for (const e of rhStep(s, Math.max(0, now - s.t), hits)) {
				judge = ARCADE_BOARD.rhythmJudge[e.judge];
				judgeT = 0.5;
			}
			if (s.over && s.counts.miss === 0) f.say(ARCADE_BOARD.rhythmFull);
		},
		draw: (g, s) => {
			g.fillStyle = "#2a1a14";
			g.fillRect(0, 0, AW, AH);
			// 流れる 帯
			g.fillStyle = "#3c2a20";
			g.fillRect(0, JY - 14, AW, 28);
			g.fillStyle = "#1a100c";
			g.fillRect(0, JY - 15, AW, 1);
			g.fillRect(0, JY + 14, AW, 1);
			// 判定の 輪（たたくと 光る）
			const glow = (lit[0] ?? 0) > 0 ? DON : (lit[1] ?? 0) > 0 ? KA : null;
			g.fillStyle = glow ?? "#5a463a";
			g.beginPath();
			g.arc(JX, JY, 12, 0, Math.PI * 2);
			g.fill();
			g.fillStyle = "#2a1a14";
			g.beginPath();
			g.arc(JX, JY, 9, 0, Math.PI * 2);
			g.fill();
			// 札（遠い 順に 描いて 近い 札を 上に）
			for (let i = s.notes.length - 1; i >= 0; i--) {
				const n = s.notes[i];
				if (!n || (n.judged && n.judged !== "miss")) continue;
				const x = JX + (n.at - s.t) * SPEED;
				if (x < -10 || x > AW + 10) continue;
				g.fillStyle = "#f4ecd8";
				g.beginPath();
				g.arc(x, JY, 8, 0, Math.PI * 2);
				g.fill();
				g.fillStyle = n.judged === "miss" ? "#505050" : n.lane ? KA : DON;
				g.beginPath();
				g.arc(x, JY, 7, 0, Math.PI * 2);
				g.fill();
				g.fillStyle = "#1a100c";
				g.fillRect(Math.round(x) - 3, JY - 2, 2, 2);
				g.fillRect(Math.round(x) + 1, JY - 2, 2, 2);
			}
			// 下の 太鼓（左 ドン・右 カッ）
			const dy = 118;
			g.fillStyle = "#8a2a1a";
			g.fillRect(AW / 2 - 34, dy - 2, 68, 30);
			g.fillStyle = (lit[0] ?? 0) > 0 ? "#fff4d8" : "#e8d8b0";
			g.fillRect(AW / 2 - 26, dy + 2, 26, 22);
			g.fillStyle = (lit[1] ?? 0) > 0 ? "#fff4d8" : "#e8d8b0";
			g.fillRect(AW / 2, dy + 2, 26, 22);
			txt(g, "ドン", AW / 2 - 13, dy + 8, 8, DON, "center");
			txt(g, "カッ", AW / 2 + 13, dy + 8, 8, KA, "center");
			if (judgeT > 0) txt(g, judge, JX, JY - 34, 10, "#ffe060", "center");
			if (s.combo >= 5)
				txt(
					g,
					fill(ARCADE_BOARD.rhythmCombo, { n: s.combo }),
					AW / 2 + 40,
					JY - 34,
					8,
					"#f4ecd8",
					"center",
				);
			hud(g, `${ARCADE_BOARD.score} ${s.score}`, `MAX ${s.maxCombo}`);
		},
		over: (s) => s.over,
		score: (s) => s.score,
		end: () => ARCADE.clear,
	}).finally(() => clock?.stop());
	if (r) saveSongBest("taiko", song.bgm, r.score);
	return r;
};

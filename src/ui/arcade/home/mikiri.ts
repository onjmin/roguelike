// 居合い 一閃の 板（決まりは data/arcade/home/mikiri.ts）。夕暮れの 野で 二人の 影が 向かいあう。
// 「！」が 出たら A か 板の どこかを タップ。押した 時刻で はかる（こまの 長さに よらない）。
// 斬りあうと 二人が 入れかわり、白い 一閃。負けた ほうが ひざを つく。

import {
	MIKIRI_TEXT,
	MK,
	MK_FOES,
	type MkState,
	mkFake,
	mkScore,
	mkStart,
	mkStep,
} from "../../../data/arcade/home/mikiri";
import { AH, AW } from "../../../data/arcade/logic";
import { ARCADE } from "../../../data/arcade/text";
import type { UiCtx } from "../../list";
import { type G, txt } from "../../neta/netaBoard";
import { type ArcadeResult, hud, isKey, isTap, playBoard } from "../arcadeKit";

const rnd = Math.random;
/** 地面の 高さ（足もと）。 */
const GY = 118;

type Pose = "stand" | "slash" | "down";

/** 影の 人（facing 1＝右を 向く）。キリコは 髪の 束と 赤い 結び目。 */
const shadow = (
	g: G,
	x: number,
	facing: 1 | -1,
	pose: Pose,
	kiriko: boolean,
): void => {
	const X = Math.round(x);
	const ink = kiriko ? "#1c1020" : "#08080e";
	const down = pose === "down" ? 8 : 0;
	const top = GY - 30 + down;
	g.fillStyle = ink;
	// 足
	if (pose === "down") {
		g.fillRect(X - 5, GY - 3, 12, 3);
		g.fillRect(X - 4 * facing - 1, GY - 8, 3, 6);
	} else {
		g.fillRect(X - 4, GY - 10, 3, 10);
		g.fillRect(X + 1, GY - 10, 3, 10);
		g.fillRect(X - 4 - facing * 2, GY - 2, 4, 2);
	}
	// 胴
	g.fillRect(X - 4, top + 8, 9, 13 - (pose === "down" ? 3 : 0));
	// 頭（負けは うつむく）
	const hx = X - 3 + (pose === "down" ? facing * 3 : 0);
	g.fillRect(hx, top + 1, 7, 7);
	if (kiriko) {
		// 髪の 束（後ろに なびく）と 結び目
		g.fillRect(hx - facing * 4 + (facing > 0 ? 0 : 4), top + 2, 4, 3);
		g.fillRect(hx - facing * 7 + (facing > 0 ? 0 : 6), top + 4, 3, 2);
		g.fillStyle = "#c83a4a";
		g.fillRect(hx + (facing > 0 ? -1 : 6), top + 1, 2, 2);
		g.fillStyle = ink;
	}
	// 刀
	g.fillStyle = pose === "slash" ? "#e8e8f4" : "#2a2a34";
	if (pose === "slash") {
		// 振りぬいた 腕と 刃（前へ まっすぐ）
		g.fillStyle = ink;
		g.fillRect(facing > 0 ? X + 4 : X - 9, top + 11, 6, 2);
		g.fillStyle = "#e8e8f4";
		g.fillRect(facing > 0 ? X + 10 : X - 25, top + 11, 16, 1);
	} else if (pose === "stand") {
		// 腰の 鞘（ななめ 後ろへ）
		for (let i = 0; i < 10; i++)
			g.fillRect(X - facing * (i - 2), top + 17 + Math.floor(i / 3), 1, 1);
		g.fillStyle = ink;
		g.fillRect(facing > 0 ? X + 3 : X - 5, top + 15, 3, 2);
	} else {
		// 落とした 刀
		g.fillRect(facing > 0 ? X + 6 : X - 18, GY - 1, 12, 1);
	}
};

/** 夕暮れの 空と 野。 */
const scenery = (g: G, clock: number): void => {
	const bands = [
		"#2a1a40",
		"#4a2050",
		"#7a2a50",
		"#b03a48",
		"#d85a3a",
		"#f08a3a",
	];
	const bh = Math.ceil((GY - 14) / bands.length);
	bands.forEach((c, i) => {
		g.fillStyle = c;
		g.fillRect(0, 14 + i * bh, AW, bh);
	});
	// 沈む 日
	g.fillStyle = "#ffd890";
	for (let y = -14; y <= 0; y++) {
		const w = Math.floor(Math.sqrt(14 * 14 - y * y));
		g.fillRect(AW / 2 - w, GY - 6 + y, w * 2, 1);
	}
	// 遠い 山
	g.fillStyle = "#3a1830";
	for (let x = 0; x < AW; x += 4) {
		const h = 8 + Math.round(Math.sin(x * 0.045) * 5 + Math.sin(x * 0.11) * 3);
		g.fillRect(x, GY - 6 - h, 4, h);
	}
	// 野
	g.fillStyle = "#1a0e18";
	g.fillRect(0, GY - 6, AW, AH - GY + 6);
	g.fillStyle = "#2a1624";
	for (let i = 0; i < 18; i++) {
		const x = (i * 37 + Math.round(Math.sin(clock * 2 + i) * 2)) % AW;
		g.fillRect(x, GY - 8, 1, 3);
		g.fillRect(x + 2, GY - 7, 1, 2);
	}
};

/** まんなかの 札（「！」や ちらつく 字）。 */
const sign = (g: G, s: string, hot: boolean): void => {
	const cx = AW / 2;
	const cy = 52;
	g.fillStyle = hot ? "#ffffff" : "#f4f2ea";
	g.fillRect(cx - 17, cy - 17, 34, 34);
	g.fillStyle = hot ? "#e02a2a" : "#3a3a48";
	g.fillRect(cx - 15, cy - 15, 30, 30);
	g.fillStyle = "#ffffff";
	g.fillRect(cx - 13, cy - 13, 26, 26);
	txt(g, s, cx, cy - 12, 24, hot ? "#e02a2a" : "#3a3a48", "center");
};

const foeName = (s: MkState): string => MK_FOES[s.round] ?? MK_FOES[0] ?? "";

export const playMikiri = (ctx: UiCtx): Promise<ArcadeResult | null> => {
	let shownRound = -1;
	return playBoard(ctx, "mikiri", {
		start: mkStart,
		note: MIKIRI_TEXT.note,
		step: (s, f) => {
			const presses: number[] = [];
			for (const e of f.evs)
				if (isKey(e, "a") || isTap(e)) presses.push(f.secOf(e.at));
			if (s.phase === "intro" && shownRound !== s.round) {
				shownRound = s.round;
				f.say(MIKIRI_TEXT.vs.replace("{name}", foeName(s)));
			}
			for (const e of mkStep(s, f.clock, presses, rnd)) {
				const ms = String(s.lastMs);
				if (e === "go") f.se("critical");
				else if (e === "fake") f.se("cursor");
				else if (e === "win") {
					f.se("swing_blade");
					f.say(MIKIRI_TEXT.win.replace("{ms}", ms));
				} else if (e === "lose") {
					f.se("hit_copper");
					f.say(
						s.why === "timeout"
							? MIKIRI_TEXT.timeout
							: MIKIRI_TEXT.slow
									.replace("{ms}", ms)
									.replace("{name}", foeName(s)),
					);
				} else if (e === "foul") {
					f.se("cancel");
					f.say(s.lost ? MIKIRI_TEXT.foulLose : MIKIRI_TEXT.foulWarn);
				} else if (e === "clear") f.say(MIKIRI_TEXT.clear);
			}
		},
		draw: (g, s, clock) => {
			scenery(g, clock);
			const t = clock - s.since;
			const fought = s.phase === "result" || s.phase === "done";
			if (fought && s.why !== "foul") {
				// 入れかわって 立つ。勝った ほうは 刃を 振りぬいた まま
				const dash = Math.min(1, t / 0.08);
				const kx = 54 + (176 - 54) * dash;
				const fx = 186 - (186 - 64) * dash;
				shadow(g, fx, -1, s.won ? "down" : "slash", false);
				shadow(g, kx, 1, s.won ? "slash" : "down", true);
				// 一閃（はじめに 白く 光る）
				if (t < 0.5) {
					g.fillStyle = `rgba(255,255,255,${Math.max(0, 0.9 - t * 1.8)})`;
					g.fillRect(0, GY - 22, AW, 2);
					if (t < 0.1) {
						g.fillStyle = "rgba(255,255,255,0.6)";
						g.fillRect(0, 14, AW, AH - 14);
					}
				}
				const msTxt = `${s.lastMs}ms`;
				txt(g, msTxt, AW / 2, 30, 16, s.won ? "#ffe8a0" : "#ff9a8a", "center");
			} else {
				shadow(g, 54, 1, s.why === "foul" ? "down" : "stand", true);
				shadow(g, 186, -1, "stand", false);
			}
			if (s.phase === "intro") {
				g.fillStyle = "rgba(0,0,0,0.45)";
				g.fillRect(0, 34, AW, 22);
				txt(g, `VS　${foeName(s)}`, AW / 2, 38, 12, "#f4f2ea", "center");
			} else if (s.phase === "go") sign(g, "！", true);
			else if (s.phase === "wait") {
				const fake = mkFake(s, clock);
				if (fake) sign(g, fake, false);
			} else if (s.phase === "foul") {
				txt(g, MIKIRI_TEXT.foul, AW / 2, 40, 16, "#ff9a8a", "center");
			}
			// 名札（斬りあう 前だけ）
			if (!fought || s.why === "foul") {
				txt(g, "キリコ", 54, GY + 6, 8, "#d8c8d8", "center");
				txt(g, foeName(s), 186, GY + 6, 8, "#d8c8d8", "center");
			}
			hud(
				g,
				`ROUND ${Math.min(s.round + 1, MK.windows.length)}/${MK.windows.length}${s.warnLeft > 0 ? "" : "　お手つき済"}`,
				`${mkScore(s)}点`,
			);
		},
		over: (s) => s.over,
		score: mkScore,
		end: (s) => (s.lost ? ARCADE.over : ARCADE.clear),
	});
};

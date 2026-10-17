// ぷゆゆキャッチャー の 板（決まりは data/arcade/home/crane.ts）。
// - 前から 見た ガラスの 箱。奥の ものほど 上に ずれて 少し 小さい。アームの 真下の 床と 景品に 影を 落とし、
//   右の 小窓に 上から 見た 位置を 出す（奥行きが わかる ように）。
// - キー：→ を 押して いる あいだ 右へ、↑ を 押して いる あいだ 奥へ（押しっぱなしは heldDir で 見る）。A で すぐ おろす。
// - タップ：板を 押して いる あいだ、いまの ボタン（→ か ↑）が 押されて いる ことに する。
//   離したのは playBoard の 入力では わからないので、window の pointerup・pointercancel を 自分で 見る。
// - とれた 景品は craneLastWins() で あとから 見られる（家具に する 用）。

import { DX, DY } from "../../../core/geom";
import {
	CR,
	CR_TEXT,
	type CrItem,
	type CrPrizeId,
	type CrState,
	crHeight,
	crPrize,
	crScore,
	crSize,
	crStart,
	crStep,
	crUnder,
} from "../../../data/arcade/home/crane";
import { AH, AW } from "../../../data/arcade/logic";
import { ARCADE } from "../../../data/arcade/text";
import type { UiCtx } from "../../list";
import type { G } from "../../neta/netaBoard";
import { txt } from "../../neta/netaBoard";
import {
	burst,
	juice,
	juiceDraw,
	juiceStep,
	pop,
	quake,
	shaken,
} from "../arcadeJuice";
import { type ArcadeResult, isKey, isTap, playBoard } from "../arcadeKit";

const rnd = Math.random;

/** 箱の 上の 行・横の 枠。 */
const TOP = 6;
const BACK_Y = CR.floorY - CR.depth;
/** 右の 板（のこり・小窓・ボタン）。 */
const PX = 210;

let lastWins: CrPrizeId[] = [];
/** さいごに 遊んだ 回で とれた 景品。 */
export const craneLastWins = (): readonly CrPrizeId[] => lastWins;

const R = (g: G, c: string, x: number, y: number, w: number, h: number) => {
	g.fillStyle = c;
	g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

const sy = (z: number, alt: number): number => CR.floorY - z * CR.depth - alt;
const scale = (z: number): number => 1 - 0.22 * z;

const RAINBOW = ["#ff7070", "#ffb050", "#90e060", "#60c0ff", "#b080ff"];

/** ぷゆゆ（🥺 の 目。x は まんなか、y は 下、u は 1画素の 大きさ）。 */
const puyu = (
	g: G,
	id: CrPrizeId,
	x: number,
	y: number,
	u: number,
	clock: number,
): void => {
	const P = crPrize(id);
	const w = 10 * u;
	const h = 9 * u;
	const X = x - w / 2;
	const Y = y - h;
	const ink =
		id === "puyuRainbow"
			? (RAINBOW[Math.floor(clock * 6 + x) % RAINBOW.length] ?? P.ink)
			: P.ink;
	R(g, "rgba(0,0,0,0.25)", X + u, y - u, w - 2 * u, u); // 影
	R(g, ink, X, Y + u, w, h - u);
	R(g, ink, X + u, Y, w - 2 * u, u);
	R(g, "rgba(255,255,255,0.3)", X + u, Y + u, 3 * u, u);
	R(g, "rgba(0,0,0,0.15)", X, y - 2 * u, w, u);
	// 目（大きく うるんだ）
	R(g, "#2a1408", X + 2 * u, Y + 3 * u, 2 * u, 3 * u);
	R(g, "#2a1408", X + 6 * u, Y + 3 * u, 2 * u, 3 * u);
	R(g, "#ffffff", X + 2 * u, Y + 3 * u, u, u);
	R(g, "#ffffff", X + 6 * u, Y + 3 * u, u, u);
	// 涙
	R(g, "#80d0ff", X + u, Y + 5 * u, u, u);
	R(g, "#80d0ff", X + 8 * u, Y + 5 * u, u, u);
	// 困った 口
	R(g, "#6a3010", X + 4 * u, Y + 7 * u, 2 * u, Math.max(1, u * 0.6));
	if (id === "puyuGold" && Math.floor(clock * 3 + x) % 3 === 0) {
		R(g, "#fff8d0", X + w - 2 * u, Y, u, u);
		R(g, "#fff8d0", X - u, Y + 4 * u, u, u);
	}
};

const drawItem = (g: G, it: CrItem, clock: number): void => {
	const k = scale(it.z) * crSize(it) * 1.5;
	puyu(g, it.id, it.x, sy(it.z, it.alt), Math.max(0.6, k), clock);
};

/** アーム（ひも・頭・3本の 爪）。 */
const drawClaw = (g: G, s: CrState): void => {
	const k = scale(s.z) * 1.4;
	const x = s.x;
	const tip = sy(s.z, s.alt);
	const head = tip - 12 * k;
	const bar = Math.max(TOP + 2, sy(s.z, CR.ceil + 16));
	// 奥行きの はり（横の 棒）
	R(g, "#8a8a9a", CR.left, bar - 1, CR.right - CR.left, 2);
	R(g, "#5a5a6a", x - 5, bar - 2, 10, 4);
	// ひも
	R(g, "#c8c8d0", x - 0.5, bar + 2, 1, Math.max(0, head - bar - 2));
	// 頭
	R(g, "#b0b0c0", x - 5 * k, head - 4 * k, 10 * k, 5 * k);
	R(g, "#e0e0ec", x - 5 * k, head - 4 * k, 10 * k, 1);
	// 爪（ひらきで 外へ）
	const spread = (2 + 6 * s.open) * k;
	g.strokeStyle = "#d0d0dc";
	g.lineWidth = Math.max(1, 1.2 * k);
	g.beginPath();
	for (const dx of [-1, 1]) {
		g.moveTo(x + dx * 3 * k, head);
		g.lineTo(x + dx * (3 * k + spread), head + 6 * k);
		g.lineTo(x + dx * (1.5 * k + spread * 0.6), tip);
	}
	g.moveTo(x, head);
	g.lineTo(x, tip - 1);
	g.stroke();
};

export const playCrane = async (ctx: UiCtx): Promise<ArcadeResult | null> => {
	const j = juice();
	// タップを 押して いる あいだ
	let tapHeld = false;
	let upAt = 0;
	const up = () => {
		tapHeld = false;
		upAt = performance.now();
	};
	window.addEventListener("pointerup", up);
	window.addEventListener("pointercancel", up);
	let rT = 0;
	let uT = 0;
	let dropNow = false;
	let lastPhase = "";
	let st: CrState | null = null;
	let shakeT = 0;
	try {
		return await playBoard(ctx, "crane", {
			note: CR_TEXT.note,
			start: () => {
				const s = crStart(rnd);
				st = s;
				lastWins = [];
				if (import.meta.env.DEV)
					(window as unknown as { __crane: CrState }).__crane = s;
				return s;
			},
			step: (s, f) => {
				juiceStep(j, f.dt);
				shakeT = Math.max(0, shakeT - f.dt);
				for (const e of f.evs) {
					if ("k" in e) {
						const h = e.repeat ? 0.15 : 0.1;
						if (e.k === "right") rT = h;
						else if (e.k === "up") uT = h;
						else if (isKey(e, "a") && s.phase === "up") dropNow = true;
					} else if (isTap(e) && e.at > upAt) tapHeld = true;
				}
				rT = Math.max(0, rT - f.dt);
				uT = Math.max(0, uT - f.dt);
				const hd = ctx.input.heldDir();
				const hr = hd !== null && (DX[hd] ?? 0) > 0;
				const hu = hd !== null && (DY[hd] ?? 0) < 0;
				const ip = {
					right: s.phase === "right" && (hr || rT > 0 || tapHeld),
					up: s.phase === "up" && (hu || uT > 0 || tapHeld),
					drop: dropNow,
				};
				dropNow = false;
				for (const e of crStep(s, f.dt, ip, rnd)) {
					if (e === "move") f.se("trolley");
					else if (e === "stop") f.se("cursor");
					else if (e === "open") f.se("cardFlip");
					else if (e === "land") f.se("put");
					else if (e === "grab") f.se("decide");
					else if (e === "miss") {
						f.se("cancel");
						f.say(CR_TEXT.miss);
					} else if (e === "slip") {
						f.se("fall");
						f.say(CR_TEXT.slip);
						quake(j, 2);
					} else if (e === "win" || e === "lucky") {
						const id = s.won[s.won.length - 1];
						const P = id ? crPrize(id) : null;
						f.se(P?.rare ? "keyItem" : "item");
						if (P)
							f.say(
								e === "lucky"
									? CR_TEXT.lucky
									: CR_TEXT.win.replace("{name}", P.name),
							);
						pop(j, 56, 112, "+1", P?.rare ? "#ffe060" : "#ffffff");
						burst(j, 56, 120, P?.rare ? "#ffe060" : "#ff90c0", 14, 60);
						if (P?.rare) j.flash = 0.25;
					} else if (e === "next") f.se("arcCoin");
				}
				if (s.phase === "carry" && lastPhase === "rise") shakeT = 0.25;
				if (s.phase !== lastPhase) {
					// 段が かわったら タップは 押しなおし
					if (s.phase === "up" || s.phase === "right") {
						tapHeld = false;
						rT = 0;
						uT = 0;
					}
					if (s.phase === "right") f.say(CR_TEXT.right);
					else if (s.phase === "up") f.say(CR_TEXT.up);
					lastPhase = s.phase;
				}
				if (s.over) {
					lastWins = [...s.won];
					f.say(CR_TEXT.got.replace("{n}", String(s.won.length)));
				}
			},
			draw: (g, s, clock) => {
				shaken(g, j, () => {
					// 台の 外（ネオン）
					R(g, "#140a1c", 0, 0, AW, AH);
					for (let i = 0; i < 12; i++) {
						const on = (Math.floor(clock * 6) + i) % 3 === 0;
						R(g, on ? "#ff60c0" : "#5a2050", 4 + i * 17, 1, 6, 2);
						R(g, on ? "#60c0ff" : "#203a5a", 4 + i * 17, AH - 3, 6, 2);
					}
					// 左の 柱の 看板（たての 字）
					for (const [i, ch] of [..."ぷゆゆ"].entries())
						txt(
							g,
							ch,
							17,
							40 + i * 16,
							12,
							Math.floor(clock * 2 + i) % 3 === 0 ? "#ffffff" : "#ff80d0",
							"center",
						);
					// 奥の 壁（水玉）と 床
					R(
						g,
						"#f8d0e0",
						CR.left - 6,
						TOP,
						CR.right - CR.left + 12,
						BACK_Y - TOP,
					);
					for (let y = TOP + 6; y < BACK_Y; y += 12)
						for (
							let x = CR.left + ((y / 12) % 2 ? 0 : 6);
							x < CR.right;
							x += 12
						)
							R(g, "#f4b4cc", x, y, 3, 3);
					g.fillStyle = "#e8a8c4";
					g.beginPath();
					g.moveTo(CR.left - 6, BACK_Y);
					g.lineTo(CR.right + 6, BACK_Y);
					g.lineTo(CR.right + 6, CR.floorY + 2);
					g.lineTo(CR.left - 6, CR.floorY + 2);
					g.fill();
					// とりだし口（左手前の 穴と 透明の かこい）
					const cy0 = sy(CR.chuteZ, 0);
					R(
						g,
						"#2a1020",
						CR.left - 4,
						cy0,
						CR.chuteX - CR.left + 4,
						CR.floorY - cy0 + 2,
					);
					txt(
						g,
						CR_TEXT.chute,
						(CR.left + CR.chuteX) / 2,
						CR.floorY + 4,
						6,
						"#ffd0e8",
						"center",
					);
					// アームの 真下の 床の 影
					const k = scale(s.z);
					g.fillStyle = "rgba(60,0,40,0.3)";
					g.beginPath();
					g.ellipse(s.x, sy(s.z, 0), 8 * k, 2.5 * k, 0, 0, Math.PI * 2);
					g.fill();
					// 景品と アーム（奥から。アームより 手前の ものは あとで）
					const order = s.items
						.filter((it) => !it.held)
						.sort((a, b) => b.z - a.z || a.alt - b.alt);
					const target = s.items[crUnder(s)];
					for (const it of order) if (it.z > s.z) drawItem(g, it, clock);
					// ねらう 景品の 上の 影
					if (target && (s.phase === "right" || s.phase === "up")) {
						g.fillStyle = "rgba(60,0,40,0.35)";
						g.beginPath();
						g.ellipse(
							s.x,
							sy(target.z, target.alt + crHeight(target)) + 1,
							6 * k,
							2 * k,
							0,
							0,
							Math.PI * 2,
						);
						g.fill();
					}
					const held = s.items[s.hold];
					const wob = shakeT > 0 ? Math.sin(clock * 60) * 1.5 : 0;
					g.save();
					g.translate(wob, 0);
					if (held) drawItem(g, held, clock);
					drawClaw(g, s);
					g.restore();
					for (const it of order) if (it.z <= s.z) drawItem(g, it, clock);
					// とりだし口の かこい（手前の 透明の 板）
					g.fillStyle = "rgba(200,240,255,0.25)";
					g.fillRect(CR.left - 4, cy0 - 16, CR.chuteX - CR.left + 4, 16);
					g.fillStyle = "rgba(255,255,255,0.6)";
					g.fillRect(CR.chuteX, cy0 - 16, 1, CR.floorY - cy0 + 18);
					g.fillRect(CR.left - 4, cy0 - 16, CR.chuteX - CR.left + 5, 1);
					// ガラスの 光
					g.fillStyle = "rgba(255,255,255,0.12)";
					for (const [x0, w] of [
						[60, 10],
						[76, 3],
						[160, 6],
					] as const) {
						g.beginPath();
						g.moveTo(x0, TOP);
						g.lineTo(x0 + w, TOP);
						g.lineTo(x0 + w - 30, CR.floorY);
						g.lineTo(x0 - 30, CR.floorY);
						g.fill();
					}
					// 枠
					g.strokeStyle = "#ff80d0";
					g.lineWidth = 2;
					g.strokeRect(
						CR.left - 7,
						TOP - 1,
						CR.right - CR.left + 14,
						CR.floorY - TOP + 4,
					);
					juiceDraw(g, j, AW, AH);
				});
				// 右の 板
				R(g, "#20142a", PX, 6, AW - PX - 2, AH - 10);
				txt(g, CR_TEXT.plays, PX + 14, 9, 7, "#ffd0e8", "center");
				txt(
					g,
					String(Math.max(0, s.plays)),
					PX + 14,
					18,
					12,
					"#ffffff",
					"center",
				);
				// とれた 数
				puyu(g, "puyu", PX + 8, 47, 0.9, clock);
				txt(g, `${crScore(s)}`, PX + 24, 38, 9, "#ffe060", "center");
				// 上から 見た 小窓
				const mx = PX + 3;
				const my = 52;
				const mw = 22;
				const mh = 18;
				R(g, "#f0c0d4", mx, my, mw, mh);
				R(
					g,
					"#2a1020",
					mx,
					my + mh * (1 - CR.chuteZ),
					((CR.chuteX - CR.left) / (CR.right - CR.left)) * mw,
					mh * CR.chuteZ,
				);
				const toM = (x: number, z: number): [number, number] => [
					mx + ((x - CR.left) / (CR.right - CR.left)) * mw,
					my + (1 - z) * mh,
				];
				for (const it of s.items) {
					const [ix, iy] = toM(it.x, it.z);
					R(
						g,
						crPrize(it.id).rare ? "#c08000" : "#b06080",
						ix - 0.5,
						iy - 0.5,
						1,
						1,
					);
				}
				const [cx, cz] = toM(s.x, s.z);
				if (Math.floor(clock * 6) % 2 === 0 || s.phase !== "up") {
					R(g, "#2040ff", cx - 1, cz - 1, 3, 3);
				}
				// ボタン（いま 押せる ほうが 光る）
				const btn = (
					y: number,
					label: string,
					live: boolean,
					down: boolean,
				) => {
					const ink = !live
						? "#3a3040"
						: down
							? "#ffffff"
							: Math.floor(clock * 3) % 2
								? "#ff60c0"
								: "#c04090";
					R(g, "#000000", PX + 2, y + 2, 24, 20);
					R(g, ink, PX + 1, y, 24, 20);
					txt(
						g,
						label,
						PX + 13,
						y + 5,
						10,
						live ? "#200818" : "#6a5a70",
						"center",
					);
				};
				const hd = ctx.input.heldDir();
				btn(
					82,
					"→",
					s.phase === "right",
					s.phase === "right" &&
						(tapHeld || (hd !== null && (DX[hd] ?? 0) > 0)),
				);
				btn(
					108,
					"↑",
					s.phase === "up",
					s.phase === "up" && (tapHeld || (hd !== null && (DY[hd] ?? 0) < 0)),
				);
			},
			over: (s) => s.over,
			score: crScore,
			end: (s) => (s.won.length > 0 ? ARCADE.clear : ARCADE.over),
		});
	} finally {
		window.removeEventListener("pointerup", up);
		window.removeEventListener("pointercancel", up);
		const fin = st as CrState | null;
		if (fin) lastWins = [...fin.won];
	}
};

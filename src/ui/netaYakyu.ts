// ランダム野球の 板（グラウンドの 三塁側の ベンチ。決まりは data/neta/yakyu.ts、文は data/neta/text.ts の YAKYU）。
// 240x150（2倍の 下地）：上に スコアボード、左に ダイヤモンド（塁の ランナー・アウト・回）、右に スレ（!random の 書きこみ）。
// はじめに >>1 の ルールA の 表 → A で はじめる。表（先攻）は 名無しが 振る（0.5秒ごと。A で 早送り）、
// 裏（後攻）は キリコが A／タップで !random。目は 0.35秒 まわって 止まる。B（板の 外の タップ）を 2回で やめる（記録なし）。
// スレの 書きこみ：キリコの 目は「蓄音キリコ【n】…」、名無しの 目・歓声・初出スレの 声（こい・さあ！…・追加点！）。

import type { JkTeamId } from "../core/jikkyoYakyu";
import { BB_SHEET, BB_SPR } from "../data/baseballSheet";
import { kirikoName } from "../data/neta/id";
import { YAKYU } from "../data/neta/text";
import {
	batterName,
	rollRandom,
	teamChar,
	YAKYU_INNINGS,
	YAKYU_ROUND,
	type YakyuLabel,
	type YakyuState,
	type YakyuStep,
	yakyuBatted,
	yakyuStart,
	yakyuStep,
} from "../data/neta/yakyu";
import { loadImage } from "../engine/assets";
import type { UiCtx } from "./list";
import { board, sleep, tick } from "./minigameBoard";
import {
	crisp,
	drawPosts,
	type G,
	type Post,
	pressesB,
	twoB,
	txt,
} from "./netaBoard";
import { fill } from "./villageTalk";

export type YakyuResult = {
	home: number;
	away: number;
	winner: "home" | "away" | "draw";
	innings: number;
	sayonara: boolean;
};

const ROLL_MS = 350;
const AWAY_GAP_MS = 500;
/** 攻める がわに うれしい 結果（黄色・打球音）と、守りの 大きな 結果（赤・miss）。ほかは ふつうの 字と cursor。 */
const HOT: ReadonlySet<YakyuLabel> = new Set([
	"hr",
	"h1",
	"h2",
	"h3",
	"bb",
	"wp",
]);
const COLD: ReadonlySet<YakyuLabel> = new Set(["tp", "dp"]);
/** 初出スレの 声：キリコの 番の 前に 出る 割合・点が 入った あとの「追加点！」の 割合。 */
const VOICE_P = 0.3;
const ADD_RUN_P = 0.2;

const BASES: readonly (readonly [number, number])[] = [
	[86, 80],
	[54, 48],
	[22, 80],
];
const HOME: readonly [number, number] = [54, 108];

const draw = (
	g: G,
	st: YakyuState,
	card: { home: JkTeamId; away: JkTeamId },
	posts: readonly Post[],
	roll: string | null,
	sheet: HTMLImageElement | null,
): void => {
	g.fillStyle = "#14241a";
	g.fillRect(0, 0, 240, 150);
	// スコアボード
	g.fillStyle = "#0c1410";
	g.fillRect(4, 3, 232, 28);
	g.strokeStyle = "#6a8a6a";
	g.strokeRect(4.5, 3.5, 231, 27);
	const cols = Math.max(YAKYU_INNINGS, st.inning);
	for (let i = 0; i < cols; i++)
		txt(g, String(i + 1), 34 + i * 18, 5, 7, "#a0b0a0", "center");
	txt(g, "R", 216, 5, 7, "#a0b0a0", "center");
	(["away", "home"] as const).forEach((side, r) => {
		const y = 13 + r * 9;
		txt(g, teamChar(card[side]), 12, y, 8, "#f4f2ea", "center");
		for (let i = 0; i < cols; i++) {
			const v = st.line[side][i];
			const now =
				i === st.inning - 1 && (side === "away") === st.top && !st.over;
			const s =
				v === undefined ? (i < st.inning - 1 || st.over ? "x" : "") : String(v);
			txt(g, s, 34 + i * 18, y, 8, now ? "#ffe060" : "#f4f2ea", "center");
		}
		txt(g, String(st.score[side]), 216, y, 8, "#ffe060", "center");
	});
	// ダイヤモンド
	g.fillStyle = "#2f6a2a";
	g.beginPath();
	g.moveTo(HOME[0], HOME[1] + 6);
	g.lineTo(BASES[0][0] + 10, BASES[0][1]);
	g.lineTo(BASES[1][0], BASES[1][1] - 10);
	g.lineTo(BASES[2][0] - 10, BASES[2][1]);
	g.closePath();
	g.fill();
	g.fillStyle = "#b08a5a";
	g.beginPath();
	g.moveTo(HOME[0], HOME[1]);
	g.lineTo(BASES[0][0], BASES[0][1]);
	g.lineTo(BASES[1][0], BASES[1][1]);
	g.lineTo(BASES[2][0], BASES[2][1]);
	g.closePath();
	g.fill();
	const man = (x: number, y: number, f: number) => {
		const s = BB_SPR.farNanashi;
		if (sheet)
			g.drawImage(sheet, s.x + f * s.w, s.y, s.w, s.h, x - 4, y - 12, s.w, s.h);
		else {
			g.fillStyle = "#ffe060";
			g.fillRect(x - 3, y - 8, 6, 8);
		}
	};
	BASES.forEach(([x, y], i) => {
		g.fillStyle = "#f4f2ea";
		g.fillRect(x - 3, y - 3, 6, 6);
		if (st.bases[i]) man(x, y - 2, i + 1);
	});
	g.fillStyle = "#f4f2ea";
	g.fillRect(HOME[0] - 3, HOME[1] - 3, 6, 6);
	if (!st.over) man(HOME[0] + 8, HOME[1], 0);
	// アウト・回
	for (let i = 0; i < 3; i++) {
		g.fillStyle = i < st.outs ? "#ff5a4a" : "#3a4a3a";
		g.beginPath();
		g.arc(10 + i * 9, 126, 3, 0, Math.PI * 2);
		g.fill();
	}
	txt(g, `${st.inning}回${st.top ? "表" : "裏"}`, 10, 134, 8, "#f4f2ea");
	if (roll) txt(g, roll, 54, 66, 14, "#ffe060", "center");
	// スレ
	drawPosts(g, posts, 110, 34, 126, 112);
};

/** ルールA の >>1。 */
const drawRules = (g: G): void => {
	g.fillStyle = "#0c0c14";
	g.fillRect(0, 0, 240, 150);
	txt(g, YAKYU.rulesHead, 6, 4, 8, "#8ab48a");
	YAKYU.rules.forEach((l, i) => {
		txt(g, l, 10, 16 + i * 11, 8, "#e8e8f0");
	});
};

/** ランダム野球（B を 2回で null）。card.home が キリコの 球団（後攻）。 */
export const playYakyu = async (
	ctx: UiCtx,
	card: { home: JkTeamId; away: JkTeamId },
): Promise<YakyuResult | null> => {
	const b = board(
		ctx,
		fill(YAKYU.title, { home: teamChar(card.home), away: teamChar(card.away) }),
		YAKYU.hint,
	);
	const g = crisp(b);
	const p = pressesB(ctx, b.root);
	const quit = twoB();
	/** 「もう　1回で　やめる」の 前の 字（1回目の B から 1.5秒 たったら もどす）。 */
	let shown = "";
	const say = (t: string) => {
		shown = t;
		b.note.textContent = t;
	};
	const sheet = await Promise.race([
		loadImage(BB_SHEET),
		sleep(1000).then(() => null),
	]);
	/** A を 待つ（B 2回で "quit"。ms を 過ぎたら "time"）。 */
	const waitA = async (
		ms = Number.POSITIVE_INFINITY,
	): Promise<"a" | "quit" | "time"> => {
		const t0 = performance.now();
		for (;;) {
			const k = p.take();
			if (k === "a") return "a";
			if (k === "b") {
				if (quit.press(p.at())) return "quit";
				b.note.textContent = YAKYU.quit1;
			}
			const now = performance.now();
			if (quit.lapsed(now)) b.note.textContent = shown;
			if (now - t0 >= ms) return "time";
			await tick();
		}
	};
	try {
		drawRules(g);
		say(YAKYU.rulesNote);
		await sleep(400);
		p.take();
		if ((await waitA()) === "quit") return null;
		const st = yakyuStart();
		const posts: Post[] = [];
		let pa = 0;
		say(fill(YAKYU.start, { home: teamChar(card.home) }));
		draw(g, st, card, posts, null, sheet);
		await sleep(700);
		while (!st.over) {
			const side = st.top ? "away" : "home";
			if (side === "home") {
				say(
					fill(YAKYU.yourTurn, {
						inning: st.inning,
						order: st.batter.home + 1,
						nick: batterName(card.home, st.batter.home),
					}),
				);
				if (Math.random() < VOICE_P) {
					posts.push({
						name: "名無し",
						body: YAKYU.voice[Math.floor(Math.random() * YAKYU.voice.length)],
					});
					draw(g, st, card, posts, null, sheet);
				}
				if ((await waitA()) === "quit") return null;
			} else {
				say(
					fill(YAKYU.theirTurn, {
						inning: st.inning,
						team: teamChar(card.away),
					}),
				);
				if ((await waitA(AWAY_GAP_MS)) === "quit") return null;
			}
			// 目が まわって 止まる
			const t0 = performance.now();
			while (performance.now() - t0 < ROLL_MS) {
				draw(
					g,
					st,
					card,
					posts,
					`【${Math.floor(Math.random() * 101)}】`,
					sheet,
				);
				await tick();
			}
			const n = rollRandom(Math.random);
			const r: YakyuStep = yakyuStep(st, n);
			ctx.se(
				HOT.has(r.label) ? "hit_bat" : COLD.has(r.label) ? "miss" : "cursor",
			);
			posts.push({
				name: side === "home" ? kirikoName(false) : "名無し",
				body: `【${n}】${YAKYU.short[r.label]}`,
				ink: HOT.has(r.label)
					? "#ffe060"
					: COLD.has(r.label)
						? "#ff8a7a"
						: undefined,
			});
			if (r.kind === "hr") posts.push({ name: "名無し", body: YAKYU.cheer.hr });
			if (r.kind === "tp") posts.push({ name: "名無し", body: YAKYU.cheer.tp });
			if (r.kind === "fine")
				posts.push({ name: "名無し", body: YAKYU.cheer.fine });
			// 追加点は もう 点を 取って いる がわだけ（その 試合の はじめての 点は 先制点）
			if (
				r.runs > 0 &&
				st.score[side] > r.runs &&
				!st.over &&
				Math.random() < ADD_RUN_P
			)
				posts.push({ name: "名無し", body: YAKYU.addRun });
			pa = yakyuBatted(pa, r);
			if (pa === YAKYU_ROUND && r.kind !== "wp")
				posts.push({ name: "名無し", body: YAKYU.cheer.round });
			say(YAKYU.kinds[r.label]);
			draw(g, st, card, posts, `【${n}】`, sheet);
			if ((await waitA(side === "home" ? 600 : 450)) === "quit") return null;
			if (r.change && !st.over) {
				say(YAKYU.change);
				await sleep(600);
			}
		}
		const res: YakyuResult = {
			home: st.score.home,
			away: st.score.away,
			winner:
				st.over === "draw" ? "draw" : st.over === "home" ? "home" : "away",
			innings: st.inning,
			sayonara: st.sayonara,
		};
		const v = {
			home: teamChar(card.home),
			away: teamChar(card.away),
			hs: res.home,
			as: res.away,
		};
		if (st.sayonara) posts.push({ name: "名無し", body: YAKYU.cheer.sayonara });
		say(
			st.sayonara
				? YAKYU.sayonara
				: fill(
						res.winner === "home"
							? YAKYU.win
							: res.winner === "away"
								? YAKYU.lose
								: YAKYU.draw,
						v,
					),
		);
		ctx.se(res.winner === "home" ? "victory" : "cancel");
		draw(g, st, card, posts, null, sheet);
		// 試合の あとは A でも B でも 閉じる（結果は もう 決まって いる。B で 字を「もう　1回で」に しない）
		const t1 = performance.now();
		while (performance.now() - t1 < 1800 && p.take() === null) await tick();
		return res;
	} finally {
		p.stop();
		b.close();
	}
};

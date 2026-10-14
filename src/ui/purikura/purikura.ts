// ゲームセンター「連コ」の プリクラ（data/village/facilities.ts の booth。決まりは data/purikura/purikura.ts）。
// - 「撮る／プリ帳を　見る／やめる」。撮るのは キリコと、親しく なった 人（喫茶か ♥2 から。ui/village/bonds.ts の bondCast。
//   村に いない 仲間は 出ない）2人まで。だれも いなければ キリコ ひとりで。
// - 板（240x150）：背景を えらぶ（←→）→ 3・2・1（ポーズは 機械が きめる）→ パシャ → 落書き（スタンプを
//   カーソルと A か タップで はる。下の 欄で 種類・もどす・できた）→ シールの 台紙（2x2）。
//   B を 2回で やめる（落書きの とちゅうなら できあがり）。板の 外の タップは B。
// - プリ帳：新しい 順に 8枚（組み立ての 手だけ 覚えて、見る たびに 描き直す）。開発の 下見では 書かない。
// - 撮った あと、写った 人が 1人 1窓 ひとこと。

import { PUYU_WALK } from "../../data/people/cast";
import type { Cast } from "../../data/people/mobs";
import {
	addToAlbum,
	decodeAlbum,
	encodeAlbum,
	PURI_BGS,
	PURI_H,
	PURI_KEEP,
	PURI_LINES,
	PURI_POSES,
	PURI_STAMP_MAX,
	PURI_STAMPS,
	PURI_TEXT,
	PURI_W,
	PURI_WITH_MAX,
	type PuriPhoto,
	type PuriStamp,
	puriDate,
	puriDateText,
	puriName,
	puriWalk,
} from "../../data/purikura/purikura";
import { devEvent } from "../../data/story/objectives";
import type { Speaker } from "../../data/story/quotes";
import { awayFriends } from "../../data/story/story";
import { loadImage } from "../../engine/assets";
import type { Story } from "../../engine/defs";
import type { Cue } from "../../engine/emote";
import { loadProgress, loadTown } from "../../engine/save";
import { spendYen } from "../../engine/wallet";
import type { Ctx } from "../ctx";
import { listWindow } from "../list";
import { board, sleep, tick } from "../minigames/minigameBoard";
import { BW, crisp, type G, pad, twoB, txt } from "../neta/netaBoard";
import { bondCast } from "../village/bonds";
import { sayAs } from "../village/villageMobs";
import { previewStage } from "../village/villageReturn";
import { drawPhoto, drawSheet, drawStamp } from "./purikuraDraw";

// ───────────────── プリ帳（保存） ─────────────────

const KEY = "kiriko-roguelike/purikura";
/** 1回の 値段（円。data/purikura/purikura.ts の PURI_TEXT.menu と そろえる）。 */
const PURI_YEN = 400;

/** 書けない ときの この回の プリ帳（下見・保存できない とき）。 */
let memo: PuriPhoto[] | null = null;

const previewing = (): boolean =>
	previewStage() !== null || devEvent() !== null;

const loadAlbum = (): PuriPhoto[] => {
	if (memo) return memo.slice();
	try {
		return decodeAlbum(localStorage.getItem(KEY));
	} catch {
		return [];
	}
};

const saveAlbum = (list: PuriPhoto[]): void => {
	memo = list.slice(0, PURI_KEEP);
	if (previewing()) return;
	try {
		localStorage.setItem(KEY, encodeAlbum(list));
	} catch {
		// 書けなくても この回は memo で 見られる
	}
};

const fill = (t: string, v: Record<string, string | number>): string =>
	t.replace(/\{(\w+)\}/g, (_, k: string) => String(v[k] ?? ""));

// ───────────────── 板の 置き場所 ─────────────────

/** 写真の 左上（板の 座標）。 */
const PX = (BW - PURI_W) / 2;
const PY = 4;
/** 下の 欄（スタンプ 6つ・もどす・できた）。 */
const CELL_W = 28;
const CELL_H = 22;
const CELLS = PURI_STAMPS.length + 2;
const CELL_X = (BW - CELLS * CELL_W) / 2;
const CELL_Y = PY + PURI_H + 4;
const UNDO = PURI_STAMPS.length;
const DONE = UNDO + 1;

const frameRect = (
	g: G,
	x: number,
	y: number,
	w: number,
	h: number,
	ink: string,
): void => {
	g.strokeStyle = ink;
	g.lineWidth = 1;
	g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
};

const arrow = (g: G, cx: number, cy: number, dir: -1 | 1, ink: string) => {
	g.fillStyle = ink;
	g.beginPath();
	g.moveTo(cx + dir * 6, cy);
	g.lineTo(cx - dir * 4, cy - 8);
	g.lineTo(cx - dir * 4, cy + 8);
	g.fill();
};

const button = (
	g: G,
	label: string,
	x: number,
	y: number,
	w: number,
	h: number,
	on: boolean,
) => {
	g.fillStyle = on ? "#ff6fae" : "#5a3050";
	g.fillRect(x, y, w, h);
	frameRect(g, x, y, w, h, "#ffd0e8");
	txt(g, label, x + w / 2, y + (h - 8) / 2, 8, "#ffffff", "center");
};

const preload = (who: readonly Cast[]): Promise<unknown> =>
	Promise.race([
		Promise.all(
			[puriWalk("kiriko"), PUYU_WALK, ...who.map(puriWalk)].map(loadImage),
		),
		sleep(1500),
	]);

// ───────────────── だれと 撮る ─────────────────

/** 写る 人（null は やめた）。 */
const pickCompanions = async (ctx: Ctx, s: Story): Promise<Cast[] | null> => {
	const away = awayFriends(loadProgress().cleared, loadTown().stage);
	const bonds = bondCast(2).filter((w) => !away.includes(w as Speaker));
	if (!bonds.length) {
		await s.narrate(PURI_TEXT.none);
		return [];
	}
	await s.wait(0);
	const picked: Cast[] = [];
	while (picked.length < PURI_WITH_MAX) {
		const rest = bonds.filter((w) => !picked.includes(w));
		if (!rest.length) break;
		const v = await listWindow(
			ctx,
			picked.length ? PURI_TEXT.pickSecond : PURI_TEXT.pickFirst,
			[
				...rest.map((w) => ({ label: puriName(w), value: w })),
				{
					label: picked.length ? PURI_TEXT.asIs : PURI_TEXT.alone,
					value: "-",
				},
			],
			{ closeLabel: PURI_TEXT.menu[2] },
		);
		if (v === null) return null;
		if (v === "-") break;
		const w = rest.find((r) => r === v);
		if (!w) break;
		picked.push(w);
		ctx.se("decide");
	}
	return picked;
};

// ───────────────── 撮る 板 ─────────────────

type Step = "bg" | "count" | "flash" | "deco" | "sheet";

/** 板で 撮る（null は やめた）。 */
const shootBoard = async (ctx: Ctx, who: Cast[]): Promise<PuriPhoto | null> => {
	await preload(who);
	const b = board(ctx, PURI_TEXT.title, PURI_TEXT.hintBg);
	const g = crisp(b);
	b.canvas.style.touchAction = "none";
	const hint = b.root.querySelector(".mgame-hint");
	const setHint = (t: string) => {
		if (hint) hint.textContent = t;
	};
	const say = (t: string) => {
		b.note.textContent = t;
	};
	const input = pad(ctx, b.canvas);
	const quit = twoB();

	let step: Step = "bg";
	let stepAt = performance.now();
	let bg = 0;
	const pose = Math.floor(Math.random() * PURI_POSES.length);
	const date = puriDate(new Date());
	const stamps: PuriStamp[] = [];
	let kind = 0;
	/** 落書きの カーソル（写真の 中か、下の 欄）。 */
	let cur: { at: "pic"; x: number; y: number } | { at: "cell"; i: number } = {
		at: "pic",
		x: PURI_W / 2,
		y: PURI_H / 2,
	};
	let lastCount = -1;
	let result: PuriPhoto | null = null;
	let done = false;

	const photo = (): PuriPhoto => ({
		with: who,
		bg,
		pose,
		date,
		stamps: stamps.slice(),
	});
	const go = (next: Step) => {
		step = next;
		stepAt = performance.now();
		if (next === "deco") {
			setHint(PURI_TEXT.hintDeco);
			say(PURI_TEXT.deco);
		} else if (next === "sheet") {
			setHint(PURI_TEXT.hintSheet);
			say(PURI_TEXT.sheet);
			result = photo();
			ctx.se("jingle");
		} else if (next === "count") {
			setHint(PURI_TEXT.hintCount);
			say(fill(PURI_TEXT.posing, { pose: PURI_POSES[pose] }));
		}
	};
	const bgName = () => fill(PURI_TEXT.bg, { name: PURI_BGS[bg] });
	const turnBg = (d: number) => {
		bg = (bg + d + PURI_BGS.length) % PURI_BGS.length;
		ctx.se("cursor");
		say(bgName());
	};

	const place = (x: number, y: number) => {
		if (stamps.length >= PURI_STAMP_MAX) {
			ctx.se("cancel");
			say(PURI_TEXT.full);
			return;
		}
		stamps.push({
			k: kind,
			x: Math.max(0, Math.min(PURI_W - 1, Math.round(x))),
			y: Math.max(0, Math.min(PURI_H - 1, Math.round(y))),
		});
		ctx.se("put");
	};
	const useCell = (i: number) => {
		if (i < UNDO) {
			kind = i;
			ctx.se("decide");
			say(PURI_STAMPS[i]);
		} else if (i === UNDO) {
			if (stamps.pop()) ctx.se("cancel");
			else ctx.se("miss");
		} else go("sheet");
	};
	const moveDeco = (dx: number, dy: number) => {
		if (cur.at === "pic") {
			const y = cur.y + dy * 5;
			if (y >= PURI_H) {
				cur = {
					at: "cell",
					i: Math.max(
						0,
						Math.min(CELLS - 1, Math.floor((cur.x + PX - CELL_X) / CELL_W)),
					),
				};
				return;
			}
			cur = {
				at: "pic",
				x: Math.max(0, Math.min(PURI_W - 1, cur.x + dx * 5)),
				y: Math.max(0, y),
			};
		} else if (dy < 0)
			cur = {
				at: "pic",
				x: Math.max(0, Math.min(PURI_W - 1, CELL_X + cur.i * CELL_W + 14 - PX)),
				y: PURI_H - 6,
			};
		else if (dx) {
			cur = { at: "cell", i: (cur.i + dx + CELLS) % CELLS };
			ctx.se("cursor");
		}
	};

	const onB = (at: number) => {
		if (step === "sheet") {
			done = true;
			return;
		}
		if (!quit.press(at)) {
			say(step === "deco" ? PURI_TEXT.deco1 : PURI_TEXT.quit1);
			return;
		}
		if (step === "deco") go("sheet");
		else done = true;
	};
	const onA = () => {
		if (step === "bg") {
			ctx.se("decide");
			go("count");
		} else if (step === "deco") {
			if (cur.at === "pic") place(cur.x, cur.y);
			else useCell(cur.i);
		} else if (step === "sheet") done = true;
	};
	const onTap = (x: number, y: number) => {
		if (step === "bg") {
			if (x < PX && y < PY + PURI_H) turnBg(-1);
			else if (x >= PX + PURI_W && y < PY + PURI_H) turnBg(1);
			else onA();
		} else if (step === "deco") {
			const px = x - PX;
			const py = y - PY;
			if (px >= 0 && px < PURI_W && py >= 0 && py < PURI_H) {
				cur = { at: "pic", x: px, y: py };
				place(px, py);
			} else if (y >= CELL_Y && y < CELL_Y + CELL_H) {
				const i = Math.floor((x - CELL_X) / CELL_W);
				if (i >= 0 && i < CELLS) {
					cur = { at: "cell", i };
					useCell(i);
				}
			}
		} else if (step === "sheet") done = true;
	};

	const draw = (now: number) => {
		const ms = now - stepAt;
		g.fillStyle = "#2a1428";
		g.fillRect(0, 0, BW, 150);
		// 機械の ふち（点滅する 電飾）
		for (let i = 0; i < 24; i++) {
			const lit = (Math.floor(now / 250) + i) % 3 === 0;
			g.fillStyle = lit ? "#ff9ad0" : "#6a3a5a";
			g.fillRect(i * 10 + 4, 146, 3, 2);
		}
		if (step === "sheet") {
			drawSheet(g, result ?? photo(), PX - 3, PY + 2);
			return;
		}
		const live = step === "bg" || step === "count";
		drawPhoto(
			g,
			{
				with: who,
				bg,
				pose: step === "bg" ? 0 : pose,
				stamps: step === "deco" ? stamps : [],
				date: step === "deco" ? date : undefined,
				frame: live ? Math.floor(now / 400) % 2 : 0,
			},
			PX,
			PY,
		);
		if (step === "bg") {
			arrow(g, PX / 2, PY + PURI_H / 2, -1, "#ffd0e8");
			arrow(g, BW - PX / 2, PY + PURI_H / 2, 1, "#ffd0e8");
			txt(g, bgName(), BW / 2, CELL_Y + 1, 8, "#ffe8f4", "center");
			button(g, PURI_TEXT.shoot, BW / 2 - 24, CELL_Y + 12, 48, 16, true);
		} else if (step === "count") {
			const n = 3 - Math.floor(ms / 800);
			if (n !== lastCount) {
				lastCount = n;
				if (n >= 1) ctx.se("cursor");
			}
			if (n >= 1) {
				g.fillStyle = "rgba(0,0,0,0.25)";
				g.fillRect(PX, PY, PURI_W, PURI_H);
				g.font = "40px 'DotGothic16', monospace";
				g.textAlign = "center";
				g.textBaseline = "middle";
				g.lineWidth = 4;
				g.strokeStyle = "#ff4f9b";
				g.strokeText(String(n), BW / 2, PY + PURI_H / 2);
				g.fillStyle = "#ffffff";
				g.fillText(String(n), BW / 2, PY + PURI_H / 2);
			} else {
				ctx.se("decide");
				say(PURI_TEXT.flash);
				go("flash");
			}
			txt(g, PURI_POSES[pose], BW / 2, CELL_Y + 6, 10, "#ffe8f4", "center");
		} else if (step === "flash") {
			g.globalAlpha = Math.max(0, 1 - ms / 500);
			g.fillStyle = "#ffffff";
			g.fillRect(0, 0, BW, 150);
			g.globalAlpha = 1;
			if (ms > 600) go("deco");
		} else if (step === "deco") {
			// 下の 欄
			for (let i = 0; i < CELLS; i++) {
				const x = CELL_X + i * CELL_W;
				const on = i === kind;
				g.fillStyle = on ? "#7a3a68" : "#4a2444";
				g.fillRect(x + 1, CELL_Y, CELL_W - 2, CELL_H);
				if (i < UNDO) {
					g.save();
					g.beginPath();
					g.rect(x + 1, CELL_Y, CELL_W - 2, CELL_H);
					g.clip();
					// 字の スタンプは 欄に 入る ように 小さく
					const k = i >= 4 ? 0.75 : 1;
					g.translate(x + CELL_W / 2, CELL_Y + CELL_H / 2);
					g.scale(k, k);
					drawStamp(g, i, 0, 0);
					g.restore();
				} else
					txt(
						g,
						i === UNDO ? PURI_TEXT.undo : PURI_TEXT.done,
						x + CELL_W / 2,
						CELL_Y + 7,
						8,
						i === DONE ? "#ffb0d8" : "#e8d8e8",
						"center",
					);
				if (on) frameRect(g, x + 1, CELL_Y, CELL_W - 2, CELL_H, "#ffd0e8");
			}
			const blink = Math.floor(now / 300) % 3 !== 0;
			if (cur.at === "cell") {
				if (blink)
					frameRect(
						g,
						CELL_X + cur.i * CELL_W - 1,
						CELL_Y - 2,
						CELL_W + 2,
						CELL_H + 4,
						"#ff3a6a",
					);
			} else {
				const x = PX + cur.x;
				const y = PY + cur.y;
				g.globalAlpha = 0.5;
				drawStamp(g, kind, x, y);
				g.globalAlpha = 1;
				if (blink) {
					g.fillStyle = "#ff3a6a";
					g.fillRect(x - 6, y, 4, 1);
					g.fillRect(x + 3, y, 4, 1);
					g.fillRect(x, y - 6, 1, 4);
					g.fillRect(x, y + 3, 1, 4);
				}
			}
			txt(
				g,
				`${stamps.length}/${PURI_STAMP_MAX}`,
				PX + PURI_W + 3,
				PY + PURI_H - 9,
				8,
				"#c8a8c0",
			);
		}
	};

	/** いまの 段（とじた 関数の 中で 書きかえるので 型を 広げて 読む）。 */
	const stepNow = (): Step => step;
	try {
		ctx.se("ui");
		say(bgName());
		while (!done) {
			const now = await tick();
			if (quit.lapsed(now))
				say(
					stepNow() === "deco"
						? PURI_TEXT.deco
						: stepNow() === "bg"
							? bgName()
							: fill(PURI_TEXT.posing, { pose: PURI_POSES[pose] }),
				);
			for (const e of input.take()) {
				if (done) break;
				if ("tap" in e) {
					onTap(e.tap[0], e.tap[1]);
					continue;
				}
				if (e.k === "b") onB(e.at);
				else if (e.k === "a") onA();
				else if (stepNow() === "bg") {
					if (e.k === "left") turnBg(-1);
					else if (e.k === "right") turnBg(1);
				} else if (stepNow() === "deco") {
					if (e.k === "left") moveDeco(-1, 0);
					else if (e.k === "right") moveDeco(1, 0);
					else if (e.k === "up") moveDeco(0, -1);
					else if (e.k === "down") moveDeco(0, 1);
				}
			}
			if (!done) draw(now);
		}
	} finally {
		input.stop();
		b.close();
	}
	return result;
};

// ───────────────── プリ帳 ─────────────────

const albumBoard = async (ctx: Ctx, list: PuriPhoto[]): Promise<void> => {
	await preload([...new Set(list.flatMap((p) => p.with))]);
	const b = board(ctx, PURI_TEXT.album, PURI_TEXT.hintAlbum);
	const g = crisp(b);
	b.canvas.style.touchAction = "none";
	const input = pad(ctx, b.canvas);
	let i = 0;
	const note = () => {
		const p = list[i];
		const names = p.with.map(puriName).join("・");
		b.note.textContent = `${fill(PURI_TEXT.page, {
			n: i + 1,
			all: list.length,
			date: puriDateText(p.date),
		})}${names ? `　${names}` : ""}`;
	};
	const turn = (d: number) => {
		if (list.length < 2) return;
		i = (i + d + list.length) % list.length;
		ctx.se("cardFlip");
		note();
	};
	try {
		ctx.se("ui");
		note();
		for (let open = true; open; ) {
			await tick();
			for (const e of input.take()) {
				if ("tap" in e) turn(e.tap[0] < BW / 2 ? -1 : 1);
				else if (e.k === "b") open = false;
				else if (e.k === "left") turn(-1);
				else if (e.k === "right" || e.k === "a") turn(1);
			}
			g.fillStyle = "#2a1428";
			g.fillRect(0, 0, BW, 150);
			drawSheet(g, list[i], PX - 3, PY + 2);
			if (list.length > 1) {
				arrow(g, 14, PY + 52, -1, "#ffd0e8");
				arrow(g, BW - 14, PY + 52, 1, "#ffd0e8");
			}
		}
	} finally {
		input.stop();
		b.close();
	}
};

// ───────────────── ひとこと ─────────────────

/** 撮った あとの ひとことの 感情の 記号（ふつうは ごきげん。照れる 人・がっかりする 人だけ べつ）。 */
const PURI_CUE: Partial<Record<Cast, Cue>> = {
	shiyo: { emote: "汗" },
	feris: { emote: "♪", gesture: "hop" },
	zero: { emote: "花" },
	nichie: { gesture: "slump" },
	ngoane: { emote: "♥" },
	onsu: { emote: "汗" },
	mujje: { emote: "!", gesture: "hop" },
	yayapoji: { gesture: "shiver" },
	aru: { emote: "♥", gesture: "hop" },
	ren: { emote: "♪", gesture: "spin" },
	rino: { emote: "…" },
	proto: { emote: "花" },
	shobon: { emote: "…" },
};

const lineOf = async (s: Story, w: Cast): Promise<void> => {
	const text = PURI_LINES[w];
	const cue = PURI_CUE[w] ?? { emote: "♪" };
	if (
		w === "roze" ||
		w === "shiyo" ||
		w === "feris" ||
		w === "zero" ||
		w === "nanj"
	)
		await s.say(w, text, cue);
	else await sayAs(s, w, text, cue);
};

// ───────────────── 入口 ─────────────────

export const purikura = async (ctx: Ctx, s: Story): Promise<void> => {
	for (;;) {
		const n = await s.choose([...PURI_TEXT.menu], { cancel: 2 });
		if (n === 1) {
			const list = loadAlbum();
			if (!list.length) {
				await s.narrate(PURI_TEXT.empty);
				continue;
			}
			await s.wait(0);
			await albumBoard(ctx, list);
			continue;
		}
		if (n !== 0) return;
		const who = await pickCompanions(ctx, s);
		if (!who) return;
		if (!spendYen(PURI_YEN, previewing())) {
			await s.narrate(PURI_TEXT.short);
			return;
		}
		s.se("arcCoin");
		await s.wait(0);
		const p = await shootBoard(ctx, who);
		if (!p) {
			await s.narrate(PURI_TEXT.quit);
			return;
		}
		saveAlbum(addToAlbum(loadAlbum(), p));
		s.se("item");
		await s.narrate(previewing() ? PURI_TEXT.gotPreview : PURI_TEXT.got);
		if (!who.length) await s.narrate(PURI_TEXT.alone1);
		for (const w of who) await lineOf(s, w);
		return;
	}
};

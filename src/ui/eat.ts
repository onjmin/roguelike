// 飲食店で 食べる（品書きと 文は data/eateries.ts、店の 形は data/village/eateries.ts と facilities.ts の 麺屋「乙」）。
// - 店番（中の 人 play:"eat"・屋台の 見える 外の 人）に 話すと、セリフを 1つ（話す たびに 次の セリフ。
//   最後の 1つは「なんに　する？」の たぐい）→ 品書き。食べた あとに また 話すと、セリフの かわりに again。
// - 券売機（部屋の plays:"eat"）は 調べた 文の あと すぐ 品書き（受けるのは 店番）。
// - 選ぶ → 店番の ひとこと → チーン → 出てきた 一品（板に 大きく。湯気が のぼる・冷たい 品は のぼらない。
//   1.2秒か A／タップ）→ 食べる 音 →
//   地の文 1〜2窓。村に いる あいだの 1回目だけ、食べた あとに 店番の「お代は　ええ」（お金の しくみは ない）。
// どれも 寄り道で、何も 持ちこまない（満腹度・道具・強さ・記録には ふれない。乱数も 使わない）。
// 板の 見た目は 別ゲーの 板（ui/minigames.ts）と 同じ クラス（.mgame）。

import { EAT_MENUS } from "../data/eateries";
import { loadImage } from "../engine/assets";
import type { Story } from "../engine/defs";
import type { Ctx } from "./ctx";
import { el } from "./dom";
import { fill } from "./villageTalk";

/** 店番の ひとこと（中の 人と 同じ 声：やきうの 声で 名前欄だけ 店番）。 */
const keeperSay = (s: Story, name: string, text: string) =>
	s.say("nanj", text, { name });

/** 次の 描画か 50ms（ペインが 隠れて rAF が 止まっても 進む）。 */
const tick = (): Promise<number> =>
	new Promise((r) => {
		const id = setTimeout(() => r(performance.now()), 50);
		requestAnimationFrame((t) => {
			clearTimeout(id);
			r(t);
		});
	});

/** 板の 大きさ（別ゲーの 板と 同じ）・品の 倍率・見せる 時間。 */
const W = 240;
const H = 150;
const SCALE = 6;
const SHOW_MS = 1200;

/**
 * 出てきた 一品（村の 窓の 上に 板を 1枚。白木の 台に 一品、湯気が のぼる。冷たい 品は 湯気なし）。
 * 1.2秒か A／タップで 閉じる。画像が 読めなければ 何も 出さない。
 * 品の 絵は 見える 画素の 下はしが マスの 下に そろえて ある（scripts/pack-rpgen.mjs の seat）。
 */
export const showDish = async (
	ctx: Ctx,
	art: string,
	title: string,
	cold = false,
): Promise<void> => {
	// 試験（node）には 画像も 画面も ない
	if (typeof Image === "undefined" || typeof document === "undefined") return;
	const img = await loadImage(art);
	if (!img) return;
	const [sx, sy, sw, sh] = art
		.slice(art.indexOf("#") + 1)
		.split(",")
		.map(Number);
	const canvas = el("canvas", { class: "mgame-canvas" });
	canvas.width = W;
	canvas.height = H;
	const root = el("div", { class: "mgame window" }, [
		el("div", { class: "mgame-title", text: title }),
		canvas,
	]);
	const g = canvas.getContext("2d");
	if (!g) return;
	g.imageSmoothingEnabled = false;
	ctx.ui.appendChild(root);
	let pressed = false;
	const pop = ctx.input.push(
		(k, repeat) => {
			if (!repeat && (k === "a" || k === "b")) pressed = true;
		},
		{ tap: "a" },
	);
	const onDown = (e: PointerEvent) => {
		e.preventDefault();
		pressed = true;
	};
	root.addEventListener("pointerdown", onDown);
	try {
		const t0 = await tick();
		for (;;) {
			const k = ((await tick()) - t0) / SHOW_MS;
			// 店の 奥（暗い 板壁）と 白木の 台
			g.fillStyle = "#2a1c12";
			g.fillRect(0, 0, W, H);
			g.fillStyle = "#3a281a";
			for (let x = 0; x < W; x += 24) g.fillRect(x, 0, 2, 112);
			g.fillStyle = "#c89a5a";
			g.fillRect(0, 112, W, H - 112);
			g.fillStyle = "#e0b878";
			g.fillRect(0, 112, W, 4);
			// 一品（下端を 台の 上に。出てくる ときは 少し 上から 置かれる）
			const drop = Math.max(0, 1 - k * 4) * 10;
			g.drawImage(
				img,
				sx,
				sy,
				sw,
				sh,
				W / 2 - (sw * SCALE) / 2,
				124 - sh * SCALE - drop,
				sw * SCALE,
				sh * SCALE,
			);
			// 湯気（3すじ。のぼって 消える。冷たい 品は なし）
			if (!cold)
				for (let i = 0; i < 3; i++) {
					const ph = (k * 1.6 + i / 3) % 1;
					g.fillStyle = `rgba(255,255,255,${(0.4 * (1 - ph)).toFixed(2)})`;
					g.fillRect(100 + i * 18, 34 - ph * 26, 4, 10);
				}
			if (k >= 1 || pressed) break;
		}
	} finally {
		pop();
		root.removeEventListener("pointerdown", onDown);
		root.remove();
	}
};

/** 品書きを 出して 食べる（id は 施設の id。品書きの ない 店なら 何もしない）。券売機からも。 */
export const eatAt = async (ctx: Ctx, s: Story, id: string): Promise<void> => {
	const m = EAT_MENUS[id];
	if (!m) return;
	const n = m.dishes.length;
	const k = await s.choose([...m.dishes.map((d) => d.name), "やめる"], {
		cancel: n,
	});
	if (k < 0 || k >= n) {
		await keeperSay(s, m.keeper, m.no);
		return;
	}
	const d = m.dishes[k];
	await keeperSay(s, m.keeper, fill(m.order, { dish: d.name }));
	// チーン（できあがりの 呼び鈴）
	s.se("glass");
	await s.wait(0);
	if (d.art) await showDish(ctx, d.art, d.name, d.cold);
	s.se("eat");
	for (const t of d.eat) await s.narrate(t);
	const ate = `eat:${id}`;
	if (!s.flag(ate)) {
		s.set(ate);
		await keeperSay(s, m.keeper, m.free);
	}
};

/** 店番に 話す（セリフを 1つ → 品書き。食べた あとは again）。lines は 中の 人・屋台の 外の 物の セリフ。 */
export const keeperTalk = async (
	ctx: Ctx,
	s: Story,
	id: string,
	name: string,
	lines: readonly string[],
): Promise<void> => {
	const m = EAT_MENUS[id];
	const key = `eatTalk:${id}`;
	const i = Number(s.flag(key) ?? 0);
	s.set(key, i + 1);
	const line = m && s.flag(`eat:${id}`) ? m.again : lines[i % lines.length];
	if (line) await keeperSay(s, name, line);
	await eatAt(ctx, s, id);
};

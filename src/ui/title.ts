// タイトル画面。rpg の title.ts を元にしている。
//
// - もぐる（新しく）／つづきから（中断セーブ）／冒険の記録／あそびかた／せってい。
// - 窓（記録・あそびかた・せってい）を開いている間は、タイトルの背景のタップで窓を閉じる
//   （ゲーム中と同じく「窓の外をタップ＝とじる」。input.bindField が一番上の窓の tap キーを押す）。
// - はじめて もぐるときだけ、前口上（INTRO）を1ページずつ見せてから始める。

import type { RunState } from "../core/types";
import { INTRO, pickQuote, type QuoteContext, SPEAKERS } from "../data/quotes";
import {
	addRecord,
	clearRun,
	hasRunSave,
	loadRecords,
	loadRun,
	recordFromRun,
	runStats,
} from "../engine/save";
import { drawWalk, stepFrame } from "../engine/sprite";
import { sleep } from "../engine/types";
import type { Ctx } from "./ctx";
import { el } from "./dom";
import { openHowto } from "./howto";
import { infoWindow, listWindow, onTap } from "./list";
import { esc, escBr, openRecords, showStory } from "./records";
import { openSettings } from "./settings";

export type TitleChoice =
	| { kind: "new" }
	| { kind: "continue"; state: RunState };

const KIRIKO = "pub:sprites/kiriko.png";
/** とうすこ（1階の敵）。キリコのうしろを ついて歩く。 */
const TOUSUKO = "sa:2kJYAl";

type Choice = "new" | "continue" | "records" | "howto" | "settings";

/**
 * ボタンの並び（行ごと）。上下で行を、左右で行の中を動く。
 * 3行目（記録・あそびかた・せってい）は小さいボタンを横に並べる（スマホの縦に収めるため）。
 */
const GRID: Choice[][] = [
	["new"],
	["continue"],
	["records", "howto", "settings"],
];

/** いちばん新しい記録から、タイトルの一言の手がかりを作る。 */
const quoteContext = (): QuoteContext => {
	const last = loadRecords()[0];
	if (!last) return null;
	const st = runStats();
	return {
		kind: last.kind,
		// 持ち帰ったときの depth は地上の手前（1）なので、いちばん深い階を渡す
		depth: last.kind === "clear" ? last.maxDepth : last.depth,
		cause: last.cause,
		runs: st.runs,
		clears: st.clears,
	};
};

export const showTitle = (ctx: Ctx): Promise<TitleChoice> =>
	new Promise((resolve) => {
		ctx.audio.bgm("title");

		const walkers = el("canvas", { class: "title-walkers" });
		walkers.width = 60;
		walkers.height = 20;
		const quote = pickQuote(quoteContext(), Date.now() % 1e9);
		const quoteEl = el("div", { class: "title-quote" });
		if (quote) {
			const sp = SPEAKERS[quote.who];
			quoteEl.innerHTML = `<b style="--char:${sp.color}">${esc(sp.name)}</b>「${escBr(quote.text)}」`;
		} else quoteEl.style.display = "none";
		const buttons = el("div", { class: "title-buttons" });
		const root = el("div", { class: "title" }, [
			el("div", { class: "title-sub", text: "トルネコ風　ローグライク" }),
			el("h1", {
				class: "title-logo",
				html: `蓄音キリコと<span class="title-logo-sub">過去ログの底</span>`,
			}),
			walkers,
			quoteEl,
			buttons,
			el("div", {
				class: "title-foot",
				text: "BGM・効果音は　右上の　🔊で　切りかえ",
			}),
		]);
		ctx.ui.appendChild(root);
		// 背景のタップ：窓が開いていれば閉じる（タイトル自身のハンドラは tap: null なので何もしない）
		ctx.input.bindField(root);

		let raf = 0;
		const anim = (t: number) => {
			const g = walkers.getContext("2d");
			if (!g || !root.isConnected) return;
			g.imageSmoothingEnabled = false;
			g.clearRect(0, 0, walkers.width, walkers.height);
			drawWalk(g, KIRIKO, "down", stepFrame(t, true), 13, 2);
			// とうすこは少し遅れて足踏みし、ときどき跳ねる
			const hop = Math.floor(t / 900) % 3 === 0 ? -1 : 0;
			drawWalk(g, TOUSUKO, "down", stepFrame(t + 130, true), 31, 2 + hop);
			raf = requestAnimationFrame(anim);
		};
		raf = requestAnimationFrame(anim);

		// 中断セーブの中身（つづきからの ボタンに階とレベルを出す。壊れていたら null）
		let saved = hasRunSave() ? loadRun() : null;
		const label: Record<Choice, { text: string; sub?: () => string }> = {
			new: { text: "もぐる", sub: () => "新しく　はじめる" },
			continue: {
				text: "つづきから",
				sub: () =>
					saved
						? `B${saved.depth}　Lv${saved.player.lv}${saved.returning ? "　帰り道" : ""}`
						: hasRunSave()
							? "中断した　冒険"
							: "中断した　冒険は　ない",
			},
			records: { text: "冒険の記録" },
			howto: { text: "あそびかた" },
			settings: { text: "せってい" },
		};
		const disabled = (c: Choice) => c === "continue" && !hasRunSave();

		let cur: Choice = hasRunSave() ? "continue" : "new";
		const render = () => {
			buttons.replaceChildren(
				...GRID.map((row) => {
					const bs = row.map((c) => {
						const l = label[c];
						const b = el("button", {
							class: `title-btn${row.length > 1 ? " title-mini" : ""}${c === cur ? " cur" : ""}${disabled(c) ? " disabled" : ""}`,
							html: `${l.text}${l.sub ? `<small>${l.sub()}</small>` : ""}`,
						});
						// 背の低い画面ではタイトルが巻き取れるので、なぞった指では決めない
						onTap(b, root, () => {
							ctx.input.onAnyInput?.();
							if (busy) {
								// 窓が開いている間にボタンを押したら、窓の外のタップとして窓を閉じる
								// （onTap がタップを止めるので、背景の bindField には届かない）
								if (!leaving) ctx.input.press("b");
								return;
							}
							if (!disabled(c)) void pick(c);
						});
						return b;
					});
					return row.length > 1 ? el("div", { class: "title-row" }, bs) : bs[0];
				}),
			);
		};

		/** 十字キー・矢印キーでカーソルを動かす（選べないボタンは飛ばす）。 */
		const move = (k: "up" | "down" | "left" | "right") => {
			let r = GRID.findIndex((row) => row.includes(cur));
			let c = GRID[r].indexOf(cur);
			if (k === "left" || k === "right") {
				const row = GRID[r];
				if (row.length < 2) return;
				c = (c + (k === "left" ? -1 : 1) + row.length) % row.length;
				cur = row[c];
			} else {
				for (let i = 0; i < GRID.length; i++) {
					r = (r + (k === "up" ? -1 : 1) + GRID.length) % GRID.length;
					const row = GRID[r];
					const next = row[Math.min(c, row.length - 1)];
					if (!disabled(next)) {
						cur = next;
						break;
					}
				}
			}
			ctx.se("cursor");
			render();
		};

		let busy = false;
		/** 始める（タイトルを閉じる）と決まった。もう入力を受けない。 */
		let leaving = false;
		const pop = ctx.input.push(
			(k) => {
				if (busy) return;
				if (k === "up" || k === "down" || k === "left" || k === "right")
					move(k);
				else if (k === "a" && !disabled(cur)) void pick(cur);
			},
			{ tap: null },
		);

		const leave = async (choice: TitleChoice, intro: boolean) => {
			leaving = true;
			pop();
			cancelAnimationFrame(raf);
			root.classList.add("leaving");
			if (intro) {
				await sleep(500);
				root.remove();
				await showStory(ctx, INTRO.map(escBr));
			}
			void ctx.audio.fadeBgm(500);
			await sleep(500);
			root.remove();
			resolve(choice);
		};

		const pick = async (c: Choice) => {
			if (busy) return;
			busy = true;
			ctx.se("decide");
			// タップで選んだボタンにもカーソルを移す（窓を閉じたあと、そこから続けられるように）
			cur = c;
			render();
			if (c === "records") await openRecords(ctx);
			else if (c === "howto") await openHowto(ctx);
			else if (c === "settings") await openSettings(ctx);
			else if (c === "continue") {
				// いつも読み直す（タイトルを開いたままの別タブの古い写しから 始めないように）
				const state = loadRun();
				if (state) {
					void leave({ kind: "continue", state }, false);
					return;
				}
				clearRun();
				saved = null;
				cur = "new";
				render();
				await infoWindow(ctx, "", "<p>続きの　記録が　こわれていました。</p>");
			} else if (c === "new") {
				// はじめての冒険（記録も中断セーブも無い）なら前口上を見せる
				const first = runStats().runs === 0 && !hasRunSave();
				if (hasRunSave()) {
					const v = await listWindow(
						ctx,
						"中断した　冒険が　あります。<br>すてて　はじめから　もぐりますか？",
						[
							{ label: "はい", value: "yes" },
							{ label: "いいえ", value: "no" },
						],
						{ start: 1 },
					);
					if (v === "yes") {
						// すてた冒険も記録に残す（やめた、として）
						const old = loadRun();
						if (old) addRecord(recordFromRun(old));
						clearRun();
						saved = null;
					}
				}
				if (!hasRunSave()) {
					void leave({ kind: "new" }, first);
					return;
				}
			}
			busy = false;
			render();
		};

		render();
	});

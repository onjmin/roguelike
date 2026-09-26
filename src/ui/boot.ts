// 起動の札：村（保守村）の上に 重ねる 小さな タイトル。ロゴ・ひとこと・村へ／冒険に　もどる。
// トルネコ1の「冒険の書」の 画面に あたる（村の 絵は 後ろで 動いている）。
// 中断して もどったときも これが 出る（冒険に　もどる が 選ばれた状態で）。
// ぜんぶ 消して はじめから やりなおすのは、村の せってい の「セーブデータを　消す」。
// 冒険の記録・図鑑・あそびかた・せってい は 村の中（人と B／☰ の メニュー）へ 移した。

import type { RunState } from "../core/types";
import { SPEAKERS } from "../data/quotes";
import { DUNGEON_NAMES } from "../data/story";
import { VILLAGE_MSG } from "../data/town";
import { clearRun, hasRunSave, loadRun } from "../engine/save";
import { sleep } from "../engine/types";
import type { Ctx } from "./ctx";
import { el } from "./dom";
import { infoWindow, onTap } from "./list";
import { esc, escBr } from "./records";
import { titleQuote } from "./villageTalk";

export type BootChoice =
	| { kind: "start" }
	| { kind: "continue"; state: RunState };

/** 中断した 冒険の 小さな札（ダンジョン・階・レベル）。 */
export const runSaveLabel = (s: RunState | null): string =>
	s
		? `${DUNGEON_NAMES[s.dungeon]?.short ?? ""}　B${s.depth}　Lv${s.player.lv}${s.returning ? "　帰り道" : ""}`
		: "中断した　冒険";

export const showBootTitle = (ctx: Ctx): Promise<BootChoice> =>
	new Promise((resolve) => {
		ctx.audio.bgm("title");
		const quote = titleQuote(Date.now() % 1e9);
		const quoteEl = el("div", { class: "title-quote" });
		if (quote) {
			const sp = SPEAKERS[quote.who];
			quoteEl.innerHTML = `<b style="--char:${sp.color}">${esc(sp.name)}</b>「${escBr(quote.text)}」`;
		} else quoteEl.style.display = "none";
		const buttons = el("div", { class: "title-buttons" });
		const logs = el("canvas", { class: "title-logs" });
		const root = el("div", { class: "title" }, [
			logs,
			el("div", { class: "title-disc" }, [
				el("div", { class: "title-disc-spin" }),
				el("div", { class: "title-disc-arm" }),
			]),
			el("h1", {
				class: "title-logo",
				html: `<span class="title-logo-pre">蓄音キリコと</span><span class="title-logo-main">過去ログの<span class="title-logo-deep">底</span></span>`,
			}),
			el("div", {
				class: "title-sub",
				text: "このスレッドは　過去ログ倉庫に　格納されています",
			}),
			quoteEl,
			buttons,
			el("div", {
				class: "title-foot",
				text: "1歩1ターンの　ローグライク　／　音は　右上の　🔊",
			}),
		]);
		ctx.ui.appendChild(root);
		sinkLogs(logs, root);
		// 窓（こわれた記録の知らせ）が開いていれば、背景のタップで閉じる
		ctx.input.bindField(root);

		type Pick = "start" | "continue";
		let saved = hasRunSave() ? loadRun() : null;
		let cur: Pick = hasRunSave() ? "continue" : "start";
		const choices = (): Pick[] =>
			hasRunSave() ? ["start", "continue"] : ["start"];
		let busy = false;
		let leaving = false;

		const render = () => {
			buttons.replaceChildren(
				...choices().map((c, i) => {
					const b = el("button", {
						class: `title-btn${c === cur ? " cur" : ""}`,
						html: `<span class="title-btn-no">${i + 1}:</span>${
							c === "start"
								? "村へ<small>保守村を　歩く</small>"
								: `冒険に　もどる<small>${esc(runSaveLabel(saved))}</small>`
						}`,
					});
					onTap(b, root, () => {
						ctx.input.onAnyInput?.();
						if (busy) {
							if (!leaving) ctx.input.press("b");
							return;
						}
						void pick(c);
					});
					return b;
				}),
			);
		};

		const pop = ctx.input.push(
			(k) => {
				if (busy) return;
				const list = choices();
				if (k === "up" || k === "down" || k === "left" || k === "right") {
					if (list.length < 2) return;
					const i = list.indexOf(cur);
					cur =
						list[
							(i + (k === "up" || k === "left" ? -1 : 1) + list.length) %
								list.length
						];
					ctx.se("cursor");
					render();
				} else if (k === "a") void pick(cur);
			},
			{ tap: null },
		);

		const leave = async (c: BootChoice) => {
			leaving = true;
			pop();
			root.classList.add("leaving");
			void ctx.audio.fadeBgm(500);
			await sleep(500);
			root.remove();
			resolve(c);
		};

		const pick = async (c: Pick) => {
			if (busy) return;
			busy = true;
			ctx.se("decide");
			cur = c;
			render();
			if (c === "start") {
				void leave({ kind: "start" });
				return;
			}
			// いつも読み直す（開いたままの 別タブの 古い写しから 始めないように）
			const state = loadRun();
			if (state) {
				void leave({ kind: "continue", state });
				return;
			}
			clearRun();
			saved = null;
			cur = "start";
			render();
			await infoWindow(ctx, "", `<p>${escBr(VILLAGE_MSG.broken)}</p>`);
			busy = false;
			render();
		};

		render();
	});

// ── うしろで 沈んでいく 過去ログ ──
// dat落ちした スレの 書きこみが ゆっくり 底へ 沈み、深いほど 暗く かすれて 消える。

const LOG_LINES = [
	"乙",
	">>1　乙",
	"保守",
	"ほんま草",
	"まだ　おるで",
	"このスレッドは　1000を　超えました",
	"dat落ち",
	"誰も　おらんのか",
	"キリコ　すこ",
	"ワイも　もぐる",
	"底には　なにが　あるんや",
	"針を　落とせ",
	"原盤　どこ",
	"B10で　力尽きた",
	"腹へった",
	"はえーすっごい",
	"せやな",
	"ぷゆゆ",
	"また　明日",
];
const WEEK = "日月火水木金土";

const logLine = (r: () => number): string => {
	const pick = LOG_LINES[Math.floor(r() * LOG_LINES.length)];
	if (r() < 0.45) return pick;
	const n = 1 + Math.floor(r() * 999);
	const y = 2009 + Math.floor(r() * 15);
	const mo = 1 + Math.floor(r() * 12);
	const d = 1 + Math.floor(r() * 28);
	const hh = String(Math.floor(r() * 24)).padStart(2, "0");
	const mm = String(Math.floor(r() * 60)).padStart(2, "0");
	const id = Math.floor(r() * 36 ** 6)
		.toString(36)
		.padStart(6, "0");
	const w = WEEK[new Date(y, mo - 1, d).getDay()];
	return r() < 0.5
		? `${n} ：名無しさん：${y}/${mo}/${d}(${w}) ${hh}:${mm} ID:${id}`
		: `${n} ：${pick}`;
};

const sinkLogs = (cv: HTMLCanvasElement, root: HTMLElement): void => {
	const g = cv.getContext("2d");
	if (!g) return;
	const r = Math.random;
	type Drop = { text: string; x: number; y: number; v: number; size: number };
	let w = 0;
	let h = 0;
	const drops: Drop[] = [];
	const spawn = (y: number): Drop => ({
		text: logLine(r),
		x: r() * w * 0.9 - w * 0.1,
		y,
		v: 6 + r() * 10,
		size: 10 + Math.floor(r() * 3) * 2,
	});
	const resize = () => {
		const dpr = Math.min(2, window.devicePixelRatio || 1);
		w = root.clientWidth;
		h = root.clientHeight;
		cv.width = Math.round(w * dpr);
		cv.height = Math.round(h * dpr);
		g.setTransform(dpr, 0, 0, dpr, 0, 0);
		const want = Math.max(10, Math.round(h / 44));
		while (drops.length < want) drops.push(spawn(r() * h));
		drops.length = want;
	};
	const draw = () => {
		g.clearRect(0, 0, w, h);
		for (const d of drops) {
			// 上では まだ 読めるが、底に 近いほど かすれて 消える
			const depth = d.y / h;
			const a = Math.max(0, 0.2 * (1 - depth) ** 1.4);
			if (a <= 0) continue;
			g.font = `${d.size}px DotGothic16, sans-serif`;
			g.fillStyle = `rgba(214, 196, 255, ${a.toFixed(3)})`;
			g.fillText(d.text, d.x, d.y);
		}
	};
	resize();
	const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
	if (still) {
		draw();
		return;
	}
	let last = performance.now();
	const tick = (t: number) => {
		if (!root.isConnected) return;
		if (root.clientWidth !== w || root.clientHeight !== h) resize();
		const dt = Math.min(0.1, (t - last) / 1000);
		last = t;
		for (let i = 0; i < drops.length; i++) {
			const d = drops[i];
			d.y += d.v * dt;
			if (d.y > h + 20) drops[i] = spawn(-10 - r() * 40);
		}
		draw();
		requestAnimationFrame(tick);
	};
	requestAnimationFrame(tick);
};

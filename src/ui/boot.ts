// 起動の札：村（保守村）の上に 重ねる 小さな タイトル。ロゴ・ひとこと・はじめる／つづきから。
// トルネコ1の「冒険の書」の 画面に あたる（村の 絵は 後ろで 動いている）。
// 中断して もどったときも これが 出る（つづきからが 選ばれた状態で）。
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

/** つづきからの 小さな札（ダンジョン・階・レベル）。 */
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
		const root = el("div", { class: "title boot" }, [
			el("div", { class: "title-sub", text: "1歩1ターンの　ローグライク" }),
			el("h1", {
				class: "title-logo",
				html: `蓄音キリコと<span class="title-logo-sub">過去ログの底</span>`,
			}),
			quoteEl,
			buttons,
			el("div", {
				class: "title-foot",
				text: "BGM・効果音は　右上の　🔊で　切りかえ",
			}),
		]);
		ctx.ui.appendChild(root);
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
				...choices().map((c) => {
					const b = el("button", {
						class: `title-btn${c === cur ? " cur" : ""}`,
						html:
							c === "start"
								? "はじめる<small>村を　歩く</small>"
								: `つづきから<small>${esc(runSaveLabel(saved))}</small>`,
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

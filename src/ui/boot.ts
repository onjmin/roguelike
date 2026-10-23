// 起動の札：一枚絵を 画面いっぱいに 敷き、ロゴと 村へ／冒険に　もどる だけを 置く。
// 中断して もどったときも これが 出る（冒険に　もどる が 選ばれた状態で）。
// ぜんぶ 消して はじめから やりなおすのは、村の せってい の「セーブデータを　消す」。
// 冒険の記録・図鑑・あそびかた・せってい は 村の中（人と B／☰ の メニュー）へ 移した。

import type { RunState } from "../core/types";
import { DUNGEON_NAMES } from "../data/story/story";
import { VILLAGE_MSG } from "../data/town/town";
import { clearRun, hasRunSave, loadRun } from "../engine/save";
import { sleep } from "../engine/types";
import type { Ctx } from "./ctx";
import { el } from "./dom";
import { floorShort } from "./dungeon/floorName";
import { infoWindow, onTap } from "./list";
import { esc, escBr } from "./village/records";

export type BootChoice =
	| { kind: "start" }
	| { kind: "continue"; state: RunState };

/** 中断した 冒険の 小さな札（ダンジョン・階・レベル）。 */
export const runSaveLabel = (s: RunState | null): string =>
	s
		? `${DUNGEON_NAMES[s.dungeon]?.short ?? ""}　${floorShort(s.dungeon, s.depth)}　Lv${s.player.lv}${s.returning ? "　帰り道" : ""}`
		: "中断した冒険";

/** ロゴ：板の 看板（「板」は 赤い 判）。ルビつき。 */
const TITLE_LOGO =
	'<span class="title-logo-pre"><ruby>蓄音<rt>チクネ</rt></ruby>キリコの</span>' +
	'<span class="title-logo-main"><ruby><span class="title-logo-ita">板</span><rt>イタ</rt></ruby>めぐり</span>';

/** blackout：札を 閉じる 前に 画面を 黒く する（はじめての 場面は 黒から 幕を 上げる）。 */
export const showBootTitle = (
	ctx: Ctx,
	blackout?: (c: BootChoice) => Promise<void> | null,
): Promise<BootChoice> =>
	new Promise((resolve) => {
		ctx.audio.bgm("opening");
		const buttons = el("div", { class: "title-buttons" });
		const art = el("img", { class: "title-art" });
		art.src = "title.png";
		art.alt = "";
		const root = el("div", { class: "title" }, [
			art,
			el("h1", { class: "title-logo", html: TITLE_LOGO }),
			buttons,
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
				...choices().map((c, i) => {
					const b = el("button", {
						class: `title-btn${c === cur ? " cur" : ""}`,
						html: `<span class="title-btn-no">${i + 1}:</span>${
							c === "start"
								? "村へ<small>おんJタウンを歩く</small>"
								: `冒険にもどる<small>${esc(runSaveLabel(saved))}</small>`
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
			const dark = blackout?.(c);
			await sleep(500);
			await dark;
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

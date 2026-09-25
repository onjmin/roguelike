// 画面上のボタン類：8方向の十字キー・A/B・小さいボタン（足踏み・足元・地図・ダッシュ・斜め・向き）・
// メニュー・ミュート。
//
// トルネコのボタンの組み合わせ（B＋方向でダッシュ、R で斜め固定、Y で向き変え…）は
// スマホでは押しにくいので、切り替えボタン（押すたびに ON/OFF）にしている。

import type { Input } from "../engine/input";
import { onSettingsChange, saveSettings, settings } from "../engine/settings";
import { el } from "./dom";

export type Hud = {
	root: HTMLElement;
	/** 上のステータス行。 */
	status: HTMLElement;
};

export const mountHud = (root: HTMLElement, input: Input): Hud => {
	const arrows = [0, 1, 2, 3, 4, 5, 6, 7].map((d) =>
		el("i", { class: `d${d}${d % 2 ? " diag" : ""}` }),
	);
	const pad = el("div", { class: "pad" }, arrows);
	const a = el("button", { class: "btn btn-a", text: "A" });
	const b = el("button", { class: "btn btn-b", text: "B" });
	const small = (label: string, cls: string) =>
		el("button", { class: `mini ${cls}`, html: label });
	const wait = small("足踏み", "mini-wait");
	const foot = small("足元", "mini-foot");
	const map = small("地図", "mini-map");
	const dash = small("ダッシュ", "mini-dash toggle");
	const diag = small("斜め", "mini-diag toggle");
	const turn = small("向き", "mini-turn toggle");
	const menu = el("button", { class: "icon-btn menu-btn", text: "☰" });
	menu.title = "メニュー";
	const mute = el("button", { class: "icon-btn mute-btn" });
	mute.title = "BGM・効果音のミュート";
	const status = el("div", { class: "status" });
	const hud = el("div", { class: "hud" }, [
		status,
		pad,
		el("div", { class: "ab" }, [b, a]),
		el("div", { class: "minis" }, [dash, diag, turn, wait, foot, map]),
		el("div", { class: "top-btns" }, [mute, menu]),
	]);
	root.appendChild(hud);

	input.bindPad(pad);
	input.bindButton(a, "a");
	input.bindButton(b, "b");
	input.bindButton(menu, "b");
	input.bindButton(wait, "wait");
	input.bindButton(foot, "foot");
	input.bindButton(map, "map");
	input.bindToggle(dash, "dash");
	input.bindToggle(diag, "diag");
	input.bindToggle(turn, "turn");
	mute.addEventListener("pointerdown", (e) => {
		e.preventDefault();
		e.stopPropagation();
		input.onAnyInput?.();
		saveSettings({ mute: !settings.mute });
	});

	const syncToggles = () => {
		dash.classList.toggle("on", input.toggles.dash);
		diag.classList.toggle("on", input.toggles.diag);
		turn.classList.toggle("on", input.toggles.turn);
	};
	input.onModsChange = syncToggles;
	syncToggles();

	const sync = () => {
		mute.textContent = settings.mute ? "🔇" : "🔊";
		mute.classList.toggle("off", settings.mute);
		hud.classList.toggle("no-pad", !settings.pad);
		hud.classList.toggle("pad-right", settings.padSide === "right");
	};
	sync();
	onSettingsChange(sync);
	return { root: hud, status };
};

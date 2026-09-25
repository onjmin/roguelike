// 画面上のボタン類：8方向の十字キー・A/B・小さいボタン（向き・足元・地図）・メニュー・ミュート。
//
// スマホの画面を ふさがないよう、小さいボタンは 3つに しぼる。
// - 足踏みは 十字キーの まん中を 長押し（トルネコの A＋B 押しっぱなし。押さえているあいだ 続ける）
// - ダッシュは 十字キーの 押しっぱなしで 足りる（歩きつづける）。キーボードでは Shift＋方向
// - 斜め固定は キーボードの R だけ（十字キーは 8方向）
// - 向きは 押しながら十字キー（トルネコの Y＋方向）。すぐ離せば 次の1回ぶん

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
	const pad = el("div", { class: "pad" }, [
		...arrows,
		el("b", { class: "pad-rest", text: "足踏み" }),
	]);
	const a = el("button", { class: "btn btn-a", text: "A" });
	const b = el("button", { class: "btn btn-b", text: "B" });
	const small = (label: string, cls: string) =>
		el("button", { class: `mini ${cls}`, html: label });
	const foot = small("足元", "mini-foot");
	const map = small("地図", "mini-map");
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
		el("div", { class: "minis" }, [turn, foot, map]),
		el("div", { class: "top-btns" }, [mute, menu]),
	]);
	root.appendChild(hud);

	input.bindPad(pad);
	input.bindButton(a, "a");
	input.bindButton(b, "b");
	input.bindButton(menu, "b");
	input.bindButton(foot, "foot");
	input.bindButton(map, "map");
	input.bindHold(turn, "turn");
	mute.addEventListener("pointerdown", (e) => {
		e.preventDefault();
		e.stopPropagation();
		input.onAnyInput?.();
		saveSettings({ mute: !settings.mute });
	});

	const syncToggles = () => {
		turn.classList.toggle("on", input.toggles.turn);
		turn.classList.toggle("down", input.heldMods.turn);
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

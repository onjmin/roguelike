// 画面上のボタン類：8方向の十字キー・A/B・矢（装備しているときだけ）・ミュート。
//
// スマホで ボタンが 多いと 操作しにくい（遊んでもらった 声）。前作（rpg）の 十字キー＋A／B に 近づける。
// - B は メニュー（1段目が もちもの。☰ は B と 同じなので 置かない）
// - 足踏みは 十字キーの まん中を 長押し（トルネコの A＋B 押しっぱなし。押さえているあいだ 続ける）
// - ダッシュは 十字キーの 押しっぱなしで 足りる（歩きつづける）。キーボードでは Shift＋方向
// - 斜め固定は キーボードの R だけ（十字キーは 8方向）
// - 向きは A が となりの 敵へ 自動で 向くので ふだんは 要らない。小さいボタン（向き・足元・地図）は
//   せっていで 出せる（向きは 押しながら十字キー。すぐ離せば 次の1回ぶん）
// - 階段の上でだけ「階段」ボタンが 出る（聞かれたのを 閉じても 降りられるように）
// - PC（マウスの ある 画面）では ボタンの すみに キーを 小さく 出す（engine/input.ts の キーと 同じ）

import type { Input } from "../engine/input";
import { onSettingsChange, saveSettings, settings } from "../engine/settings";
import { el } from "./dom";

export type Hud = {
	root: HTMLElement;
	/** 上のステータス行。 */
	status: HTMLElement;
	/** 村（保守村）と ダンジョンで ボタンを 切りかえる。村では ステータス行・小さいボタン・矢を 隠す。 */
	setMode(mode: "village" | "dungeon"): void;
};

export const mountHud = (root: HTMLElement, input: Input): Hud => {
	const arrows = [0, 1, 2, 3, 4, 5, 6, 7].map((d) =>
		el("i", { class: `d${d}${d % 2 ? " diag" : ""}` }),
	);
	const rest = el("b", { class: "pad-rest", text: "足踏み" });
	const pad = el("div", { class: "pad" }, [...arrows, rest]);
	const a = el("button", { class: "btn btn-a", text: "A" });
	// B は メニュー（窓の中では 隠れて、窓の「とじる」を使う）
	const b = el("button", { class: "btn btn-b", text: "メニュー" });
	// 装備した矢を撃つ（矢を装備しているときだけ出る。トルネコ1の 矢の装備と同じ）
	const shoot = el("button", {
		class: "btn btn-shoot",
		html: "矢<small></small>",
	});
	const small = (label: string, cls: string) =>
		el("button", { class: `mini ${cls}`, html: label });
	const foot = small("足元", "mini-foot");
	const map = small("地図", "mini-map");
	const turn = small("向き", "mini-turn toggle");
	const mute = el("button", { class: "icon-btn mute-btn" });
	mute.title = "BGM・効果音のミュート";
	const status = el("div", { class: "status" });
	const hud = el("div", { class: "hud" }, [
		status,
		pad,
		el("div", { class: "ab" }, [b, shoot, a]),
		el("div", { class: "minis" }, [turn, foot, map]),
		el("div", { class: "top-btns" }, [mute]),
	]);
	root.appendChild(hud);
	// PC の キー（CSS で マウスの ある 画面だけ 見せる）
	const kbd = (b: HTMLElement, key: string) =>
		b.appendChild(el("kbd", { class: "kbd-hint", text: key }));
	kbd(a, "Z");
	kbd(b, "X");
	kbd(shoot, "Q");
	kbd(foot, "G");
	kbd(map, "M");
	kbd(turn, "F");
	kbd(rest, "E");

	input.bindPad(pad);
	input.bindButton(a, "a");
	input.bindButton(b, "b");
	input.bindButton(shoot, "shoot");
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
		hud.classList.toggle("show-minis", settings.minis);
	};
	sync();
	onSettingsChange(sync);
	const setMode = (mode: "village" | "dungeon") => {
		hud.classList.toggle("village", mode === "village");
	};
	return { root: hud, status, setMode };
};

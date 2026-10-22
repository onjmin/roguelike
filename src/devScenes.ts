// 場面の 再生（デバッグ）：`?debug&scene` で 場面の 一覧を 出し、えらんだ 場面だけを 村で 再生する。
// 進み具合は その 場面の 手前まで noteRunEnd で 本物と 同じ ように 積んで（前の 板は 持ち帰って 語りも 見おえた
// 扱い）、`?arrive=` の 帰り方で 村に 着く（devSandbox.ts）。保存は sandbox（sessionStorage）だけ なので、
// 本物の セーブには さわらない。2幕目（転・話の つなぎ・開いた 知らせ）は 着いたあと 蓄音機の 前で 始まる。

import { DUNGEONS } from "./core/data/dungeons";
import type { DungeonId } from "./core/types";
import { DUNGEON_NAMES } from "./data/story/story";
import { loadProgress, noteRunEnd, saveProgress } from "./engine/save";

const PREFIX = "kiriko-roguelike/";

/** 物語の 順（本筋 → 寄り道 → 町で 見つける 板）。 */
const ORDER: readonly DungeonId[] = [
	"shallow",
	"kinoko",
	"main",
	"deep",
	"tropical",
	"konamono",
	"festival",
	"hidden",
	"vocalo",
	"mercury",
	"onmu",
	"onkimu",
	"inferno",
];

/** 場面の 種類。 */
type Take = "first" | "again" | "dead" | "ten";

const TAKES: { take: Take; label: string }[] = [
	{ take: "first", label: "はじめての持ち帰り" },
	{ take: "again", label: "2回目からの持ち帰り" },
	{ take: "dead", label: "倒れて帰る" },
];

/** その 板が 開くまでに 持ち帰る 板（古い 順）。 */
const before = (d: DungeonId): DungeonId[] => {
	const up = DUNGEONS[d].unlockAfter;
	return up ? [...before(up), up] : [];
};

/** 板を 開く 旗（仲間の 依頼・町の 寄り道で 見つける）。 */
const flagsFor = (ds: readonly DungeonId[]): string[] =>
	ds.flatMap((d) => {
		const f = DUNGEONS[d].unlockFlag;
		return f ? [f] : [];
	});

/** 一度きりの 場面を 見おえた 旗（前の 板で 済んだ ことに する）。 */
const seenFlags = (cleared: readonly DungeonId[]): string[] => [
	...(cleared.includes("shallow") ? ["eve_kinoko"] : []),
	...(cleared.includes("kinoko") ? ["eve_main"] : []),
	...(cleared.includes("main") ? ["ten", "toldBlackout"] : []),
];

/** 板を 持ち帰って、語りも 知らせも 見おえた。 */
const clearSeen = (d: DungeonId): void => {
	noteRunEnd(d, "clear", "scene");
	const p = loadProgress();
	p.endings = [...new Set([...(p.endings ?? []), d])];
	p.news = [];
	p.eventNews = [];
	p.event = undefined;
	saveProgress(p);
};

const addFlags = (flags: readonly string[]): void => {
	const p = loadProgress();
	p.flags = [...new Set([...(p.flags ?? []), ...flags])];
	saveProgress(p);
};

/** 場面の 手前まで 進み具合を 積んで、着く 帰り方（arrive）を 返す。 */
const stage = (d: DungeonId, take: Take): string => {
	for (const k of Object.keys(sessionStorage))
		if (k.startsWith(PREFIX)) sessionStorage.removeItem(k);
	sessionStorage.setItem(`${PREFIX}opening`, "1");
	const prior = before(d);
	addFlags(flagsFor([...prior, d]));
	for (const b of prior) {
		clearSeen(b);
		addFlags(seenFlags(loadProgress().cleared));
	}
	// はじめの 語り（intro）は ぜんぶ 見た
	const p = loadProgress();
	p.intro = [...ORDER];
	saveProgress(p);
	const objective = DUNGEONS[d].objective;
	if (take === "dead") {
		noteRunEnd(d, "dead", "scene");
		return `dead.${d}`;
	}
	if (take === "again") clearSeen(d);
	// 転：風呂板の 語りを 見おえた 帰り（旗 ten が まだ）。転は 2幕目（蓄音機の 前）で 始まる
	if (take === "ten") {
		clearSeen(d);
		const q = loadProgress();
		q.flags = (q.flags ?? []).filter(
			(f) => f !== "ten" && f !== "toldBlackout",
		);
		saveProgress(q);
		return `escape.${d}`;
	}
	if (take === "first") noteRunEnd(d, "clear", "scene");
	return `clear.${d}.${objective}`;
};

const go = (d: DungeonId, take: Take): void => {
	const arrive = stage(d, take);
	location.href = `${location.pathname}?debug&sandbox&scene&raf&arrive=${arrive}`;
};

const menuUrl = (): string => `${location.pathname}?debug&sandbox&scene`;

const button = (label: string, onClick: () => void): HTMLButtonElement => {
	const b = document.createElement("button");
	b.textContent = label;
	b.style.cssText =
		"font:inherit;font-size:14px;padding:6px 10px;margin:3px 6px 3px 0;border:1px solid #6a6a8a;" +
		"background:#24243a;color:#eee;border-radius:4px;cursor:pointer";
	b.onclick = onClick;
	return b;
};

/** 場面の 一覧（村より 前に 出して、えらぶまで ゲームは 始めない）。 */
const showMenu = (): void => {
	const root = document.createElement("div");
	root.style.cssText =
		"position:fixed;inset:0;z-index:100000;overflow:auto;background:#12121c;color:#eee;" +
		"font-family:sans-serif;padding:16px;box-sizing:border-box";
	const h = document.createElement("h1");
	h.textContent = "場面の再生（デバッグ）";
	h.style.cssText = "font-size:20px;margin:0 0 6px";
	const note = document.createElement("p");
	note.textContent =
		"えらんだ場面の手前まで進めた村に着きます。保存はこのタブだけ（本物のセーブはさわりません）。" +
		"2幕目（転・次の話へのつなぎ・開いた知らせ）は、着いたあと蓄音機の前に行くと始まります。";
	note.style.cssText =
		"font-size:13px;color:#aab;margin:0 0 12px;max-width:720px";
	root.append(h, note);
	for (const d of ORDER) {
		const sec = document.createElement("div");
		sec.style.cssText =
			"margin:0 0 10px;padding:8px 0;border-top:1px solid #333";
		const t = document.createElement("div");
		t.textContent = DUNGEON_NAMES[d].name;
		t.style.cssText = "font-weight:bold;margin:0 0 4px";
		sec.append(t);
		for (const { take, label } of TAKES)
			sec.append(button(label, () => go(d, take)));
		if (d === "main")
			sec.append(
				button("転（停電）：2回目の帰り → 蓄音機", () => go(d, "ten")),
			);
		root.append(sec);
	}
	document.body.append(root);
};

/** 再生中の 場面から 一覧へ もどる 札（画面の 右上）。 */
const showBack = (): void => {
	const a = document.createElement("a");
	a.href = menuUrl();
	a.textContent = "場面をえらぶ";
	a.style.cssText =
		"position:fixed;top:4px;right:4px;z-index:100000;font:12px sans-serif;color:#fff;" +
		"background:rgba(0,0,0,.6);padding:3px 8px;border-radius:4px;text-decoration:none";
	document.body.append(a);
};

/**
 * `?debug&scene`（pnpm dev では `?scene` だけでも）：一覧を 出して true（ゲームは 始めない）。
 * 場面を 再生中（arrive つき）は もどる 札を 出して false。
 */
export const sceneMenu = (): boolean => {
	const q = new URLSearchParams(location.search);
	if (!q.has("scene") || !(import.meta.env.DEV || q.has("debug"))) return false;
	// 本物の セーブに さわらない ように、一覧も sandbox で 開きなおす
	if (!q.has("sandbox")) {
		location.replace(menuUrl());
		return true;
	}
	if (q.has("arrive")) {
		showBack();
		return false;
	}
	showMenu();
	return true;
};

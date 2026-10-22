// 場面の 再生（デバッグ）：`?debug&scene` で 場面の 一覧を 出し、えらんだ 場面だけを 村で 再生する。
// 進み具合は その 場面の 手前まで noteRunEnd で 本物と 同じ ように 積んで（前の 板は 持ち帰って 語りも 見おえた
// 扱い）、`?arrive=` の 帰り方で 村に 着く（devSandbox.ts）。保存は sandbox（sessionStorage）だけ なので、
// 本物の セーブには さわらない。2幕目（転・話の つなぎ・開いた 知らせ）は 着いたあと 蓄音機の 前で 始まる。
// サブイベント：寸劇（きっかけに ふれたら かならず 起きる。起きる 所の そばから 始める）・越してくる 人・
// 期間限定の イベント（2幕目で 知らせる）。

import { DUNGEONS } from "./core/data/dungeons";
import type { DungeonId } from "./core/types";
import { MOBS } from "./data/people/mobs";
import { ARRIVALS } from "./data/story/arrivals";
import { EVENTS } from "./data/story/objectives";
import { SKITS, type Skit } from "./data/story/skits";
import { DUNGEON_NAMES } from "./data/story/story";
import { revivedAreas } from "./data/town/revival";
import { FACILITIES, facilityDoor } from "./data/village/facilities";
import { ROOM_OUTSIDE } from "./data/village/rooms";
import {
	growTown,
	loadProgress,
	loadTown,
	noteRunEnd,
	type RunRecord,
	saveProgress,
	saveTown,
} from "./engine/save";
import type { Dir } from "./engine/types";
import { forceSkit } from "./ui/village/skits";

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

/** 帰りの 場面の 種類。 */
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

/** その 板まで（前の 板と その 板）。 */
const upTo = (d: DungeonId): DungeonId[] => [...before(d), d];

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

/** 冒険を 1回 終えた（進み具合と 記録。記録が ないと 村は「まだ 1度も 帰って いない」扱い）。 */
let clock = 0;
const run = (d: DungeonId, kind: "clear" | "dead" | "escape"): void => {
	noteRunEnd(d, kind, "scene");
	const rec: RunRecord = {
		at: Date.now() - 3_600_000 + ++clock * 1000,
		kind,
		cause: kind === "dead" ? "デバッグ" : "",
		depth: 1,
		maxDepth: 1,
		lv: 1,
		turn: 0,
		kills: 0,
		returning: kind !== "dead",
		seed: "scene",
		dungeon: d,
	};
	const list = JSON.parse(
		sessionStorage.getItem(`${PREFIX}records`) ?? "[]",
	) as RunRecord[];
	sessionStorage.setItem(`${PREFIX}records`, JSON.stringify([rec, ...list]));
};

/** 町の 一度きりの 知らせ（通りの 生き返り・倉庫の 広がり）と 住人の はじめましてを 見おえた。 */
const settle = (): void => {
	const t = loadTown();
	const cleared = loadProgress().cleared;
	t.revived = [
		...new Set([...t.revived, ...revivedAreas(cleared).map((a) => a.id)]),
	];
	growTown(t);
	saveTown(t);
	sessionStorage.setItem(
		`${PREFIX}mobs`,
		JSON.stringify({ met: Object.keys(MOBS) }),
	);
	addFlags(["toldWallet", "toldWalletWhy", "toldStoreKnown"]);
};

/** 寸劇・越してくる 人の 再生：ぷゆゆの 弁当も もう もらった（着いて すぐ 別の 場面が 始まらない ように）。 */
const quiet = (): void => {
	const t = loadTown();
	t.lunch = true;
	saveTown(t);
};

/** 板を 持ち帰って、語りも 知らせも 見おえた。 */
const clearSeen = (d: DungeonId): void => {
	run(d, "clear");
	const p = loadProgress();
	p.endings = [...new Set([...(p.endings ?? []), d])];
	p.news = [];
	p.eventNews = [];
	p.event = undefined;
	saveProgress(p);
	settle();
};

const addFlags = (flags: readonly string[]): void => {
	const p = loadProgress();
	p.flags = [...new Set([...(p.flags ?? []), ...flags])];
	saveProgress(p);
};

/** 保存を 空に して、板（古い 順・重なって いても よい）を 持ち帰って 見おえた ところまで 進める。 */
const prepare = (
	boards: readonly DungeonId[],
	open: readonly DungeonId[] = [],
): void => {
	for (const k of Object.keys(sessionStorage))
		if (k.startsWith(PREFIX)) sessionStorage.removeItem(k);
	sessionStorage.setItem(`${PREFIX}opening`, "1");
	const chain = ORDER.filter((d) => boards.includes(d));
	addFlags(flagsFor([...chain, ...open]));
	for (const b of chain) {
		clearSeen(b);
		addFlags(seenFlags(loadProgress().cleared));
	}
	// はじめの 語り（intro）は ぜんぶ 見た
	const p = loadProgress();
	p.intro = [...ORDER];
	saveProgress(p);
	// 財布に 10万円（入湯料・買い物の 寸劇を すぐ 見られる ように。使った 額を マイナスに する：engine/wallet.ts）
	sessionStorage.setItem(
		`${PREFIX}wallet`,
		JSON.stringify({ v: 1, spent: -100_000 }),
	);
};

/** 帰りの 場面の 手前まで 積んで、着く 帰り方（arrive）を 返す。 */
const stage = (d: DungeonId, take: Take): string => {
	prepare(before(d), [d]);
	const objective = DUNGEONS[d].objective;
	if (take === "dead") {
		run(d, "dead");
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
	if (take === "first") run(d, "clear");
	return `clear.${d}.${objective}`;
};

const base = (): string => `${location.pathname}?debug&sandbox&scene&raf`;

const go = (d: DungeonId, take: Take): void => {
	location.href = `${base()}&arrive=${stage(d, take)}`;
};

// ───────────────── 寸劇 ─────────────────

/** 地図の 名前（施設は f_<id>、銭湯は bath）。 */
const mapName = (map: string): string =>
	map === "village"
		? "村"
		: map === "bath"
			? "銭湯"
			: map.startsWith("f_")
				? (FACILITIES.find((f) => f.id === map.slice(2))?.name ?? map)
				: map;

/** 名前を 「」で かこむ（もう 「」の ある 名前は その まま）。 */
const quoted = (name: string): string =>
	name.includes("「") ? name : `「${name}」`;

/** 地図の 入口の 前（入れば その 地図）。 */
const doorSpot = (map: string): string | null => {
	if (map === "bath") {
		const o = ROOM_OUTSIDE.bath;
		return `${o.x},${o.y},up`;
	}
	const f = map.startsWith("f_")
		? FACILITIES.find((x) => x.id === map.slice(2))
		: undefined;
	const door = f ? facilityDoor(f) : null;
	return door ? `${door[0]},${door[1] + 1},up` : null;
};

/** 寸劇の きっかけ（一覧と 再生中の 札に 出す）と、始める 所。 */
const skitCue = (sk: Skit): { hint: string; spot: string | null } => {
	const on = sk.on;
	if (on.k === "enter")
		return { hint: `${quoted(mapName(on.map))}に入る`, spot: doorSpot(on.map) };
	if (on.k === "buy")
		return {
			hint: `${quoted(mapName(on.map))}でお金を払う${on.thing ? `（${on.thing}）` : ""}`,
			spot: doorSpot(on.map),
		};
	if (on.k === "look")
		return {
			hint: `「${on.thing}」を調べる${on.map ? `（${mapName(on.map)}の中）` : ""}`,
			spot: on.map ? doorSpot(on.map) : null,
		};
	if (on.k === "death")
		return {
			hint: `${MOBS[on.mob].name}に話しかける（本物では「${on.cause}」で倒れたあと）`,
			spot: null,
		};
	const x = Math.floor((on.x[0] + on.x[1]) / 2);
	const y = Math.floor((on.y[0] + on.y[1]) / 2);
	return {
		hint: `${mapName(on.map)}の(${on.x[0]}〜${on.x[1]}, ${on.y[0]}〜${on.y[1]})に来る`,
		spot: on.map === "village" ? `${x},${y + 1},up` : null,
	};
};

/** 寸劇の 起きる あいだ（window）に 合う 進み具合。無ければ 本筋の 終わりまで（町が いちばん 育った 所）。 */
const skitBoards = (sk: Skit): DungeonId[] => {
	const w = sk.window;
	const all = w?.after ? upTo(w.after) : upTo("deep");
	const stop = w?.before;
	return stop
		? all.filter((d) => d !== stop && !before(d).includes(stop))
		: all;
};

const goSkit = (sk: Skit): void => {
	prepare(skitBoards(sk));
	quiet();
	const { spot } = skitCue(sk);
	location.href = `${base()}&skit=${sk.key}${spot ? `&spot=${spot}` : ""}`;
};

// ───────────────── 越してくる 人・期間限定 ─────────────────

const goMove = (key: string): void => {
	const a = ARRIVALS.find((x) => x.key === key);
	if (!a) return;
	prepare(upTo(a.after));
	quiet();
	const x = Math.floor((a.at.x[0] + a.at.x[1]) / 2);
	const y = Math.floor((a.at.y[0] + a.at.y[1]) / 2);
	location.href = `${base()}&move=${key}&spot=${x},${y},down`;
};

const goEvent = (id: string): void => {
	const ev = EVENTS.find((e) => e.id === id);
	if (!ev) return;
	prepare([...(ev.need?.cleared ?? []).flatMap(upTo), ...before(ev.dungeon)]);
	const p = loadProgress();
	p.event = { id, since: p.outings ?? 0, clearsSince: 0 };
	p.eventNews = [{ id, started: true }];
	saveProgress(p);
	location.href = `${base()}&arrive=escape.${ev.dungeon}`;
};

// ───────────────── 画面 ─────────────────

const menuUrl = (): string => `${location.pathname}?debug&sandbox&scene`;

const button = (label: string, onClick: () => void): HTMLButtonElement => {
	const b = document.createElement("button");
	b.textContent = label;
	b.style.cssText =
		"font:inherit;font-size:14px;padding:6px 10px;margin:3px 6px 3px 0;border:1px solid #6a6a8a;" +
		"background:#24243a;color:#eee;border-radius:4px;cursor:pointer;text-align:left";
	b.onclick = onClick;
	return b;
};

const section = (title: string, note?: string): HTMLDivElement => {
	const sec = document.createElement("div");
	sec.style.cssText = "margin:0 0 10px;padding:8px 0;border-top:1px solid #333";
	const t = document.createElement("div");
	t.textContent = title;
	t.style.cssText = "font-weight:bold;margin:0 0 4px";
	sec.append(t);
	if (note) {
		const p = document.createElement("div");
		p.textContent = note;
		p.style.cssText = "font-size:12px;color:#aab;margin:0 0 4px";
		sec.append(p);
	}
	return sec;
};

const heading = (text: string): HTMLHeadingElement => {
	const h = document.createElement("h2");
	h.textContent = text;
	h.style.cssText = "font-size:17px;margin:18px 0 6px;color:#ffd166";
	return h;
};

/** 窓の 1行目（一覧で どの 寸劇か わかる ように）。 */
const firstLine = (lines: readonly { text?: string }[]): string =>
	(lines.find((l) => l.text)?.text ?? "").split("\n")[0];

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
	root.append(h, note, heading("帰りの場面"));
	for (const d of ORDER) {
		const sec = section(DUNGEON_NAMES[d].name);
		for (const { take, label } of TAKES)
			sec.append(button(label, () => go(d, take)));
		if (d === "main")
			sec.append(
				button("転（停電）：2回目の帰り → 蓄音機", () => go(d, "ten")),
			);
		root.append(sec);
	}
	root.append(
		heading("寸劇"),
		(() => {
			const sec = section(
				"",
				"起きる所のそばから始まります（起動の札は「村へ」）。えらんだ寸劇だけ、見こみ・期間・見たかに関係なく1回起きます。",
			);
			for (const sk of SKITS) {
				const b = button(`${skitCue(sk).hint}　${firstLine(sk.lines)}`, () =>
					goSkit(sk),
				);
				b.style.display = "block";
				sec.append(b);
			}
			return sec;
		})(),
		heading("越してくる人"),
		(() => {
			const sec = section("", "起きる所に着きます（起動の札は「村へ」）。");
			for (const a of ARRIVALS) {
				const b = button(
					`${a.mobs.map((m) => MOBS[m].name).join("・")}　${firstLine(a.lines)}`,
					() => goMove(a.key),
				);
				b.style.display = "block";
				sec.append(b);
			}
			return sec;
		})(),
		heading("期間限定のイベント"),
		(() => {
			const sec = section(
				"",
				"始まった帰りに着きます。知らせは蓄音機の前で。目的は出口の立て札で。",
			);
			for (const ev of EVENTS)
				sec.append(
					button(`${ev.name}（${DUNGEON_NAMES[ev.dungeon].name}）`, () =>
						goEvent(ev.id),
					),
				);
			return sec;
		})(),
	);
	document.body.append(root);
};

/** 再生中の 場面から 一覧へ もどる 札と、寸劇の きっかけ（画面の 右上）。 */
const showBack = (hint?: string): void => {
	const box = document.createElement("div");
	box.style.cssText =
		"position:fixed;top:4px;right:4px;z-index:100000;font:12px sans-serif;color:#fff;" +
		"background:rgba(0,0,0,.65);padding:3px 8px;border-radius:4px;max-width:60vw;text-align:right";
	const a = document.createElement("a");
	a.href = menuUrl();
	a.textContent = "場面をえらぶ";
	a.style.cssText = "color:#fff;text-decoration:underline";
	box.append(a);
	if (hint) {
		const p = document.createElement("div");
		p.textContent = `寸劇：${hint}`;
		p.style.cssText = "margin-top:2px;color:#ffd166";
		box.append(p);
	}
	document.body.append(box);
};

const debugOn = (q: URLSearchParams): boolean =>
	import.meta.env.DEV || q.has("debug");

/**
 * `?debug&scene`（pnpm dev では `?scene` だけでも）：一覧を 出して true（ゲームは 始めない）。
 * 場面を 再生中（arrive・skit・move つき）は もどる 札を 出して false。
 */
export const sceneMenu = (): boolean => {
	const q = new URLSearchParams(location.search);
	if (!q.has("scene") || !debugOn(q)) return false;
	// 本物の セーブに さわらない ように、一覧も sandbox で 開きなおす
	if (!q.has("sandbox")) {
		location.replace(menuUrl());
		return true;
	}
	const skit = SKITS.find((s) => s.key === q.get("skit"));
	if (skit) {
		forceSkit(skit.key);
		showBack(skitCue(skit).hint);
		return false;
	}
	if (q.has("arrive") || q.has("move")) {
		showBack();
		return false;
	}
	showMenu();
	return true;
};

/** 場面の 再生で 始める 所（`&spot=x,y,向き`。起動の 札から 村へ 入る とき）。 */
export const devSpot = (): { x: number; y: number; dir: Dir } | null => {
	if (typeof location === "undefined") return null;
	const q = new URLSearchParams(location.search);
	if (!q.has("scene") || !q.has("sandbox") || !debugOn(q)) return null;
	const [x, y, dir] = (q.get("spot") ?? "").split(",");
	if (!x || !y) return null;
	return {
		x: Number(x),
		y: Number(y),
		dir: (["up", "down", "left", "right"].includes(dir) ? dir : "down") as Dir,
	};
};

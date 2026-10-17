// いちばん最初の 村（はじめて 起動して「はじめる」を 押したあと 1回だけ）。
// 説明は 動きの 中で、1つずつ（STORY.md §0「世界を 見せる ときは キャラを 動かす」）。文は data/town/town.ts の OPENING。
// ① 幕あき：キリコが 蓄音機を 引いて 南の 坂を 上がり、シャッターを たたく（貼り紙で 町が 空っぽな わけ）。
// ② 自分で 歩く：広場に 入るまで（広場より 先に 村を 出ようと すると、キリコが 引きかえす）。
// ③ 広場に 入ると（onStep）：蓄音機を 置いて 鳴らす → だれも 来ない → 名無しが 見出しを 貼って 走り去る →
//    パン兵が 行進して きて 広場を 占領（3段）。
// ④ 見出しの 名無しが 消えた ほうから やきうが 歩いて くる。町の 名・空っぽな わけ・行き先・キリコの 望みを かけあいで。
// ⑤ やきうが 家の 前へ もどる あいだに カメラで 南の 桟橋（出口）を 見せて 目的を 1行。ぷゆゆが お弁当を 持って くる。
// ②の あいだは パン兵・やきう・ぷゆゆ・蓄音機を 隠しておく（部屋に 出入りして 建てなおしても）。
// 見終わってから 覚える（途中で 閉じたら 次も ①から）。一度でも もぐった人には 出さない。

import { INCIDENT_BGM, stageBgm } from "../../data/audio/music";
import { MOBS } from "../../data/people/mobs";
import { INCIDENTS, incidentPlaceId } from "../../data/town/incidents";
import { OPENING, type OpeningLine } from "../../data/town/town";
import { type Cell, VILLAGE_SPOTS } from "../../data/village/map";
import type { Script, Story } from "../../engine/defs";
import { cueOf } from "../../engine/emote";
import { loadProgress, loadRecords } from "../../engine/save";
import { lunchScript, villageView } from "./villageReturn";

const KEY = "kiriko-roguelike/opening";

/** 保存できないときの この回の 写し。 */
let seenMemo = false;

/** ①を 見おえて、広場に 入るのを 待って いる（この回だけ。閉じたら ①から）。 */
let walking = false;

/** 出口の 矢印を 出さない（①〜④。⑤で カメラが 出口を 見せる ときに はじめて 出す）。 */
let guideHeld = false;

const seen = (): boolean => {
	try {
		if (localStorage.getItem(KEY) === "1") return true;
	} catch {
		// 読めなければ この回の 写し
	}
	return seenMemo;
};

const markSeen = (): void => {
	seenMemo = true;
	walking = false;
	try {
		localStorage.setItem(KEY, "1");
	} catch {
		// 保存できなくても この回は 覚えている
	}
};

/** 出口の 矢印を まだ 出さない（ui/village/village.ts）。 */
export const openingHoldsGuide = (): boolean => guideHeld;

/** 試験用：この回の 写しを 忘れる。 */
export const forgetOpeningMemo = (): void => {
	seenMemo = false;
	walking = false;
	guideHeld = false;
};

/** 最初の 村の 場面を 見せるか（まだ 見ていない・一度も もぐっていない）。 */
export const needsOpening = (): boolean =>
	!seen() &&
	loadRecords().length === 0 &&
	!loadProgress().intro.includes("shallow");

/** ②の あいだ（広場に 入る 前）。村の 出口は まだ 使えない。 */
export const openingWalking = (): boolean => walking && needsOpening();

/** キリコが 歩きはじめる 所（南の 坂の 下。南の 口は 桟橋の 先の 港 (20,51)）。 */
const OPENING_START = [20, 31] as const;

/** ①で たたく シャッター（広場の 南の 音楽室。パン板を 持ち帰るまで 閉まって いる）と、その 前で 立つ マス。 */
const SHUTTER_FRONT = [22, 29] as const;

/** ③が 始まる 広場（この 四角に 入ったら）。 */
const PLAZA = { x0: 12, x1: 27, y0: 18, y1: 24 } as const;

/** パン兵（広場を 占領する 騒ぎの 人。data/town/incidents.ts）と、行進して くる 坂の 上の マス。 */
const PANHEI = INCIDENTS.find((i) => i.dungeon === "shallow")?.people ?? [];
const MARCH_FROM: readonly Cell[] = [
	[18, 25],
	[19, 25],
	[20, 25],
];

/** 見出しを 貼りに くる 名無し（村の 来客の 人。やきうの 家の 前から 来て、もどって 消える）。 */
const POSTER = "visitor";

/** 幕が 上がる前に：①から なら 坂の 下に 立つ。②の あいだも ③で 出てくる 人と 物は 隠す。 */
export const openingPrepare = (s: Story): void => {
	guideHeld = true;
	if (!walking) {
		const [x, y] = OPENING_START;
		s.place("player", x, y, "up");
	}
	s.hide("phono");
	s.hide("nanj");
	// ぷゆゆも 広場の 場面の 最後に かけて くる（「お客、ゼロ人」の とき 広場に いない）
	s.hide("mob_puyu");
	for (const p of PANHEI) s.hide(incidentPlaceId(p));
};

/** かけあいの 1窓。 */
const line = async (s: Story, l: OpeningLine): Promise<void> => {
	if (l.who === "kiriko") await s.kiriko(l.text, "voice", cueOf(l));
	else if (l.who === "nanj") await s.say("nanj", l.text, cueOf(l));
	else await s.narrate(l.text);
};

/** ①：坂を 上がって シャッターを たたく。そのあと 自分で 歩く。 */
export const openingScript = async (s: Story): Promise<void> => {
	if (walking) return;
	// だれも いない 町（曲なし）
	s.bgm(null);
	const [sx, sy] = OPENING_START;
	const [fx, fy] = SHUTTER_FRONT;
	// 歩きながら 名のる（窓を 出して いる あいだも 歩く）
	const climb = s.move("player", "uu", { speed: 0.6 });
	for (const l of OPENING.climb) await line(s, l);
	await climb;
	await s.wait(0);
	await s.move(
		"player",
		"u".repeat(Math.max(0, sy - 2 - fy)) + "r".repeat(Math.max(0, fx - sx)),
	);
	s.face("player", "up");
	// シャッターを たたく → 返事 なし → 貼り紙
	for (let i = 0; i < 3; i++) {
		s.se("hit_fist");
		await s.wait(260);
	}
	await s.wait(500);
	await s.narrate(OPENING.notice);
	await line(s, OPENING.closed);
	walking = true;
};

/** ②の あいだに 村を 出ようと した：引きかえす（step は 村へ もどる 1歩）。 */
export const openingNotYet = async (
	s: Story,
	step: string | null,
): Promise<void> => {
	await line(s, OPENING.notYet);
	if (step) await s.move("player", step);
};

/** ②の あいだ、広場に 入ったら ③④⑤（data/village の 踏む イベント：ui/village/village.ts の onStep）。 */
export const openingStep = (x: number, y: number): Script | null =>
	openingWalking() &&
	x >= PLAZA.x0 &&
	x <= PLAZA.x1 &&
	y >= PLAZA.y0 &&
	y <= PLAZA.y1
		? plazaScript
		: null;

/** ③④⑤：広場。 */
const plazaScript: Script = async (s) => {
	walking = false;
	// 蓄音機を 置いて 鳴らす（ここが キリコの 起きる 所に なる）
	const [bx, by] = VILLAGE_SPOTS.boot;
	await s.goto("player", bx, by);
	s.face("player", "up");
	s.show("phono");
	s.se("put");
	await s.wait(300);
	s.bgm(stageBgm(0));
	await s.wait(1600);
	// だれも 来ない（左右を 見る）
	s.face("player", "left");
	await s.wait(500);
	s.face("player", "right");
	await s.wait(500);
	s.face("player", "down");
	await line(s, OPENING.nobody);
	// 名無しが やきうの 家の 前から 走って きて、掲示板に 見出しを 貼って 走り去る
	const [nx, ny] = VILLAGE_SPOTS.nanj(villageView());
	const [ox, oy] = VILLAGE_SPOTS.board[1] ?? VILLAGE_SPOTS.board[0];
	s.set(POSTER);
	s.show(POSTER);
	s.place(POSTER, nx, ny + 1);
	await s.goto(POSTER, ox, oy + 1, { speed: 1.8, avoid: true });
	s.face(POSTER, "up");
	s.se("put");
	await s.wait(300);
	s.face("player", "left");
	const away = s.goto(POSTER, nx, ny + 1, { speed: 2.2, avoid: true });
	await s.narrate(OPENING.headline);
	await away;
	s.set(POSTER, false);
	s.hide(POSTER);
	// パン兵が 坂を 行進して きて 広場を 占領する
	s.bgm(INCIDENT_BGM);
	const march = PANHEI.map((p, i) => {
		const id = incidentPlaceId(p);
		const [mx, my] = MARCH_FROM[i] ?? MARCH_FROM[0];
		s.show(id);
		s.place(id, mx, my, "up");
		return s
			.goto(id, p.at[0], p.at[1], { speed: 0.8, avoid: true })
			.then(() => s.face(id, p.dir));
	});
	s.face("player", "down");
	await Promise.all(march);
	const chief = PANHEI[PANHEI.length - 1];
	if (chief) await s.say("nanj", OPENING.panhei, { name: chief.name });
	await line(s, OPENING.someone);
	// やきうが 人影の 消えた ほう（家の 前）から 歩いて きて、キリコの 左に 立つ（右は パン兵長）
	s.show("nanj");
	s.place("nanj", nx, ny, "down");
	await s.look("nanj");
	await s.wait(0);
	await s.goto("nanj", bx - 1, by, { speed: 1.2, avoid: true });
	s.face("nanj", "player");
	s.face("player", "left");
	await s.look(null);
	for (const l of OPENING.talk) await line(s, l);
	// パン兵が 掲示板に 差し押さえの 札を 打ちつける（それを 見て キリコが きく）
	const nailer = PANHEI[0];
	if (nailer) {
		const id = incidentPlaceId(nailer);
		s.face(id, "left");
		s.face("player", "up");
		for (let i = 0; i < 2; i++) {
			s.se("hit_fist");
			await s.wait(300);
		}
		s.face(id, nailer.dir);
		s.face("player", "left");
	}
	for (const l of OPENING.talk2) await line(s, l);
	for (const t of OPENING.mouth) await s.say("nanj", t);
	for (const l of OPENING.wish) await line(s, l);
	// やきうが 家の 前へ もどる あいだに、カメラで 南の 桟橋（出口）を 見せて 行き先を 1行
	await s.wait(0);
	const back = s.goto("nanj", nx, ny);
	guideHeld = false;
	await s.look(VILLAGE_SPOTS.exit);
	for (const t of OPENING.goal) await s.narrate(t);
	await s.look(null);
	await back;
	markSeen();
	// ぷゆゆが お弁当を 持って かけて くる（はじめての 潜りの 前に）
	const [px, py] = MOBS.puyu.spot;
	s.place("mob_puyu", px, py);
	s.show("mob_puyu");
	await lunchScript(s);
};

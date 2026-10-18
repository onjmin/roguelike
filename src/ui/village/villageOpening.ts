// いちばん最初の 村（はじめて 起動して「はじめる」を 押したあと 1回だけ）。
// 説明は 動きの 中で、1つずつ（STORY.md §0「世界を 見せる ときは キャラを 動かす」）。文は data/town/town.ts の OPENING。
// ① 幕あき：キリコが 蓄音機を 引いて 南の 坂を 上がり、シャッターを たたく（貼り紙で 町が 空っぽな わけ）。
// ② 自分で 歩く：広場に 入るまで（広場より 先に 村を 出ようと すると、キリコが 引きかえす）。
// ③ 1日目（広場に 入ると。onStep）：蓄音機を 置いて 鳴らす → だれも 来ない → 遠くの 原住民 → やきうが 家から 来て、
//    町の 名・空っぽな わけ・いま いる 住人・キリコの 望みを かけあいで。
// 空は 場面で きめる（ui/village/sceneSky.ts）：①〜③は 夕方（やきうの「暗なってきた」）、④は 夜、⑤⑥は 2日目の 朝。
// 見おえると 村の 時計は 2日目の 朝から すすむ。
// ④ 夜：広場で 寝る。暗い 中、名無しが 掲示板に 見出しを 貼って 走り去る。
// ⑤ 2日目：パン兵が 行進して きて 広場を 占領 → 見出し → やきうが かけて きて、パン板・板の 潜り方・倒れたら を かけあいで。
//    広場（キリコの ステージ）を 返して ほしいから 行く。
// ⑥ やきうと 桟橋まで 歩く → ぷゆゆが お弁当を 持って くる → やきうが 見送って 家へ もどる → 目的を 1行。
// ②の あいだは パン兵・やきう・ぷゆゆ・蓄音機を 隠しておく（部屋に 出入りして 建てなおしても）。
// 見終わってから 覚える（途中で 閉じたら 次も ①から）。一度でも もぐった人には 出さない。

import { INCIDENT_BGM, stageBgm } from "../../data/audio/music";
import { MOBS } from "../../data/people/mobs";
import { boardPicture } from "../../data/story/pictures";
import { HEADLINES } from "../../data/town/headlines";
import { INCIDENTS, incidentPlaceId } from "../../data/town/incidents";
import { OPENING, type OpeningLine } from "../../data/town/town";
import { type Cell, VILLAGE_SPOTS } from "../../data/village/map";
import type { Script, Story } from "../../engine/defs";
import { cueOf } from "../../engine/emote";
import { loadProgress, loadRecords } from "../../engine/save";
import { showCard } from "../../engine/sceneCard";
import { fxRoot } from "../../engine/sceneFx";
import { setSceneSky } from "./sceneSky";
import { sayAs } from "./villageMobs";
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
	else if (l.who === "shobon") await sayAs(s, "shobon", l.text, cueOf(l));
	else await s.narrate(l.text);
};

const lines = async (s: Story, ls: readonly OpeningLine[]): Promise<void> => {
	for (const l of ls) await line(s, l);
};

/** ⑥で キリコと やきうが 立つ 桟橋の 先（南の 口 VILLAGE_SPOTS.exit の 2つ 上と、その 左）。 */
const pierAt = (): Cell => [VILLAGE_SPOTS.exit[0], VILLAGE_SPOTS.exit[1] - 2];

/** ①：坂を 上がって シャッターを たたく。そのあと 自分で 歩く。 */
export const openingScript = async (s: Story): Promise<void> => {
	if (walking) return;
	// だれも いない 夕方の 町（曲なし）
	s.bgm(null);
	setSceneSky("evening");
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
	// 西の 空き地の 原住民が 聞いて いる（来ない）
	const [sx, sy] = MOBS.shobon.spot;
	const [first, ...rest] = OPENING.shobon;
	s.face("player", "left");
	if (first) await line(s, first);
	await s.look([sx, sy]);
	await lines(s, rest.slice(0, 1));
	await s.look(null);
	await lines(s, rest.slice(1));
	// 1日目：やきうが 家の 前から 歩いて きて、キリコの 左に 立つ
	const [nx, ny] = VILLAGE_SPOTS.nanj(villageView());
	s.show("nanj");
	s.place("nanj", nx, ny, "down");
	await s.look("nanj");
	await s.wait(0);
	await s.goto("nanj", bx - 1, by, { speed: 1.2, avoid: true });
	s.face("nanj", "player");
	s.face("player", "left");
	await s.look(null);
	await lines(s, OPENING.day1);
	// 夜：やきうは 家へ。キリコは 蓄音機の 前で 寝る
	await s.fadeBgm(800);
	await s.fadeOut(600);
	setSceneSky("night");
	s.place("nanj", nx, ny, "down");
	s.face("player", "down");
	await s.fadeIn(600);
	await line(s, OPENING.sleep);
	// 暗い 中、名無しが やきうの 家の 前から 走って きて、掲示板に 見出しを 貼って 走り去る
	const [ox, oy] = VILLAGE_SPOTS.board[1] ?? VILLAGE_SPOTS.board[0];
	s.set(POSTER);
	s.show(POSTER);
	s.place(POSTER, nx, ny + 1);
	await s.goto(POSTER, ox, oy + 1, { speed: 1.8, avoid: true });
	s.face(POSTER, "up");
	s.se("put");
	await s.wait(300);
	await s.goto(POSTER, nx, ny + 1, { speed: 2.2, avoid: true });
	s.set(POSTER, false);
	s.hide(POSTER);
	await s.wait(400);
	// 2日目の 朝：パン兵が 坂を 行進して くる 音で 起きる
	await s.fadeOut(800);
	setSceneSky("morning");
	await s.fadeIn(600);
	s.bgm(INCIDENT_BGM);
	await line(s, OPENING.wake);
	const march = PANHEI.map((p, i) => {
		const id = incidentPlaceId(p);
		const [mx, my] = MARCH_FROM[i] ?? MARCH_FROM[0];
		s.show(id);
		s.place(id, mx, my, "up");
		return s
			.goto(id, p.at[0], p.at[1], { speed: 0.8, avoid: true })
			.then(() => s.face(id, p.dir));
	});
	await Promise.all(march);
	const chief = PANHEI[PANHEI.length - 1];
	const chiefSay = async (t: string): Promise<void> => {
		if (chief) await s.say("nanj", t, { name: chief.name });
	};
	await chiefSay(OPENING.panhei);
	await line(s, OPENING.someone);
	// 夜の うちに 貼られた 見出し（掲示板の 実物の 絵：見出しが どこに どう 貼って ある 物か 見せる）
	s.face("player", "left");
	const headline = showCard(fxRoot(), boardPicture(HEADLINES.shallow ?? ""));
	s.se("read");
	await s.narrate(OPENING.headline);
	headline.end();
	// やきうが 家から かけて きて、キリコの 左に 立つ（右は パン兵長）
	await s.goto("nanj", bx - 1, by, { speed: 1.8, avoid: true });
	s.face("nanj", "player");
	s.face("player", "left");
	await lines(s, OPENING.day2);
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
	// 見出しとは：やきうが 掲示板を 指さして 言う（カメラは 掲示板。絵は 貼って ある 見出しの 実物。
	// 仕組みの 矢印図には しない：2026-10-18 作者「どういうところについている見出しか画像をもってこい」）
	await s.look(VILLAGE_SPOTS.board[0]);
	s.face("nanj", "up");
	const card = showCard(fxRoot(), boardPicture(HEADLINES.shallow ?? ""));
	await lines(s, OPENING.midashi);
	card.end();
	await s.look(null);
	s.face("nanj", "player");
	await lines(s, OPENING.midashiNext);
	await lines(s, OPENING.day2b);
	await chiefSay(OPENING.declare);
	await lines(s, OPENING.day2c);
	for (const t of OPENING.mouth) await s.say("nanj", t);
	await lines(s, OPENING.rules);
	await lines(s, OPENING.wish);
	// ⑥ やきうと 桟橋まで 歩く（歩きながら 話す）
	const [qx, qy] = pierAt();
	guideHeld = false;
	const go = Promise.all([
		s.goto("player", qx, qy, { speed: 1.1 }),
		s.goto("nanj", qx - 1, qy, { speed: 1.1, avoid: true }),
	]);
	await lines(s, OPENING.walk);
	await go;
	s.face("player", "down");
	s.face("nanj", "player");
	markSeen();
	// ぷゆゆが お弁当を 持って かけて くる（はじめての 潜りの 前に）
	const [px, py] = MOBS.puyu.spot;
	s.place("mob_puyu", px, py);
	s.show("mob_puyu");
	await lunchScript(s);
	// やきうが 見送って 家へ もどる。行き先を 1行
	s.face("player", "left");
	await line(s, OPENING.farewell);
	const back = s.goto("nanj", nx, ny);
	s.face("player", "down");
	for (const t of OPENING.goal) await s.narrate(t);
	await back;
	// 村の 時計は 2日目の 朝から
	setSceneSky(null);
};

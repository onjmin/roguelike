// いちばん最初の 村（はじめて 起動して「はじめる」を 押したあと 1回だけ）。
// それまでは 前口上が ダンジョンの口を 踏んでから だったので、村に 置かれた 時点では
// だれで・なにを して・どこへ 行けば いいのかが わからなかった。
// ここで 1作目の スレの あと 南の 道から 歩いて 来る → 前口上（人が 散って 保守村に なった）→ 広場に 蓄音機を 置く →
// キリコの 独白（スレが 伸びない）→ やきうが 声を かけて 歩いてきて 目的と 口を 教える（カメラで 見せる）→ 目的を 1行。
// 見終わってから 覚える（途中で 閉じたら 次も 見せる）。一度でも もぐった人には 出さない。
// 文は data/town.ts の OPENING。

import { OPENING } from "../data/town";
import { VILLAGE_SPOTS } from "../data/village/map";
import type { Story } from "../engine/defs";
import { loadProgress, loadRecords } from "../engine/save";
import { villageView } from "./villageReturn";

const KEY = "kiriko-roguelike/opening";

/** 保存できないときの この回の 写し。 */
let seenMemo = false;

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
	try {
		localStorage.setItem(KEY, "1");
	} catch {
		// 保存できなくても この回は 覚えている
	}
};

/** 試験用：この回の 写しを 忘れる。 */
export const forgetOpeningMemo = (): void => {
	seenMemo = false;
};

/** 最初の 村の 場面を 見せるか（まだ 見ていない・一度も もぐっていない）。 */
export const needsOpening = (): boolean =>
	!seen() &&
	loadRecords().length === 0 &&
	!loadProgress().intro.includes("shallow");

/** 最初の 村に 来る ところ：南の 道の はし（村の 出口）に 立って いる。蓄音機は まだ 置いていない（幕が 上がる 前に）。 */
export const openingPrepare = (s: Story): void => {
	const [x, y] = OPENING_START;
	s.place("player", x, y, "up");
	s.hide("phono");
};

/** キリコが 歩きはじめる 所（南の 出口）と、広場で 蓄音機を 置く 所（起きる 所）。 */
const OPENING_START = [20, 31] as const;

/** 最初の 村の 場面。 */
export const openingScript = async (s: Story): Promise<void> => {
	// 1作目の スレの あと、南の 道から 人の 散った 保守村へ 歩いてくる
	for (const t of OPENING.arrive) await s.narrate(t);
	const [sx, sy] = OPENING_START;
	const [bx0, by0] = VILLAGE_SPOTS.boot;
	// 窓を しまってから 歩く
	await s.wait(0);
	await s.move(
		"player",
		"u".repeat(sy - by0) + (bx0 < sx ? "l" : "r").repeat(Math.abs(sx - bx0)),
	);
	s.face("player", "up");
	const [first, place] = OPENING.premise;
	await s.narrate(first);
	// 広場に 蓄音機を 置く（ここが キリコの 起きる 所に なる）
	s.show("phono");
	s.se("item");
	await s.narrate(place);
	for (const t of OPENING.think) await s.kiriko(t, "think");
	// 小屋の前の やきうが 声を かける
	await s.look("nanj");
	for (const t of OPENING.nanjCall) await s.say("nanj", t);
	// 呼んでから キリコの そばまで 歩いてくる（離れたまま 話しこまない）
	const [bx, by] = [s.state.x, s.state.y];
	await s.goto("nanj", bx + 1, by, { speed: 1.6 });
	s.face("nanj", "player");
	await s.look(null);
	await s.look(VILLAGE_SPOTS.exit);
	for (const t of OPENING.nanjMouth) await s.say("nanj", t);
	await s.look(null);
	// 話しおえたら 小屋の 前へ もどる
	const [nx, ny] = VILLAGE_SPOTS.nanj(villageView());
	await s.goto("nanj", nx, ny);
	for (const t of OPENING.goal) await s.narrate(t);
	markSeen();
};

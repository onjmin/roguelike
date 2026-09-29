// いちばん最初の 村（はじめて 起動して「はじめる」を 押したあと 1回だけ）。
// それまでは 前口上が ダンジョンの口を 踏んでから だったので、村に 置かれた 時点では
// だれで・なにを して・どこへ 行けば いいのかが わからなかった。
// ここで 前口上（人が 散って 保守村に なった・スレが 伸びない）→ キリコの 独白 → やきうが 目的と 口を 教える（カメラで 見せる）→ 目的を 1行 → 困ったら フェリス。
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

/** 最初の 村の 場面。 */
export const openingScript = async (s: Story): Promise<void> => {
	for (const t of OPENING.premise) await s.narrate(t);
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

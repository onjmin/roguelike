// いちばん最初の 村（はじめて 起動して「はじめる」を 押したあと 1回だけ）。
// それまでは 前口上が ダンジョンの口を 踏んでから だったので、村に 置かれた 時点では
// だれで・なにを して・どこへ 行けば いいのかが わからなかった。
// ここで 前口上（蓄音機に 針が 無い）→ おんJ民が 口を 教える（カメラで 見せる）→ 目的を 1行 → 困ったら フェリス。
// 見終わってから 覚える（途中で 閉じたら 次も 見せる）。一度でも もぐった人には 出さない。
// 文は data/town.ts の OPENING。

import { OPENING } from "../data/town";
import { VILLAGE_SPOTS } from "../data/village/map";
import type { Story } from "../engine/defs";
import { loadProgress, loadRecords } from "../engine/save";

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
	// 口の前で 見張っている おんJ民が 声を かける
	await s.look("nanj");
	for (const t of OPENING.nanjCall) await s.say("nanj", t);
	await s.look(VILLAGE_SPOTS.mouth.shallow);
	for (const t of OPENING.nanjMouth) await s.say("nanj", t);
	await s.look(null);
	for (const t of OPENING.goal) await s.narrate(t);
	markSeen();
};

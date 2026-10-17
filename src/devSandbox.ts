// 開発用：`?sandbox` を 付けると、この タブの 保存を ぜんぶ sessionStorage に 向ける（pnpm dev か ?debug のときだけ）。
// 本物の セーブ（localStorage）は 読みも 書きも しない。タブを 閉じれば 消える。読みなおしでは 残るので、
// 開発者ツールから `localStorage.setItem("kiriko-roguelike/progress", …)` で 進み具合を 置いて 読みなおせば 好きな 場面を 見られる。
// ほかの どの 読みこみより 先に 走らせたいので、main.ts の いちばん 上で import する。

import { DUNGEON_IDS } from "./core/data/dungeons";
import type { DungeonId, Objective } from "./core/types";

const sandboxed = (): boolean => {
	if (typeof location === "undefined") return false;
	const q = new URLSearchParams(location.search);
	return (import.meta.env.DEV || q.has("debug")) && q.has("sandbox");
};

if (sandboxed())
	Object.defineProperty(window, "localStorage", {
		configurable: true,
		get: () => window.sessionStorage,
	});

/**
 * `?sandbox&arrive=dead.kinoko`（`clear.festival.boss` なども）：起動の 札を とばして、その 帰り方で 村に 着いた 場面から 始める。
 * 冒険の 終わりの 記録（recordRunEnd）は しないので、知らせ・倒れた 回数は 先に 進み具合へ 置いておく。
 */
export const devArrival = (): {
	kind: "clear" | "escape" | "dead";
	dungeon: DungeonId;
	objective?: Objective;
} | null => {
	if (!sandboxed()) return null;
	const [kind, dungeon, objective] = (
		new URLSearchParams(location.search).get("arrive") ?? ""
	).split(".");
	if (kind !== "clear" && kind !== "escape" && kind !== "dead") return null;
	if (!DUNGEON_IDS.includes(dungeon as DungeonId)) return null;
	return {
		kind,
		dungeon: dungeon as DungeonId,
		objective: (objective as Objective) || undefined,
	};
};

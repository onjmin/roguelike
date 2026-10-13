// キリコの 家の 遊べる 家具の ゲームの 試験（1つの ゲームに 1つの ファイル。src/sim/arcadeTests.ts が まとめて 回す）。

export type HomeGameTest = { name: string; run: () => void | Promise<void> };

export class HomeFail extends Error {}
export const ok = (cond: unknown, why: string): void => {
	if (!cond) throw new HomeFail(why);
};

/** 種つきの 乱数（決まった 手で 回す）。 */
export const seeded = (seed: number): (() => number) => {
	let s = seed >>> 0 || 1;
	return () => {
		s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
		return s / 2 ** 32;
	};
};

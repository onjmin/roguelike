// シードつき乱数（sfc32）。状態は4つの整数なので、そのまま中断セーブに入れられる。
//
// 読み直しても同じ結果になる（セーブ＆ロードで乱数を引き直せない）ように、
// ゲームの乱数はすべてこれを通す。Math.random は使わない。

export type RngState = [number, number, number, number];

export class Rng {
	private a: number;
	private b: number;
	private c: number;
	private d: number;

	constructor(state: RngState) {
		[this.a, this.b, this.c, this.d] = state;
	}

	/** 文字列や数からシードを作る（同じ入力なら同じ並び）。 */
	static fromSeed(seed: number | string): Rng {
		let h = 1779033703 ^ String(seed).length;
		const s = String(seed);
		for (let i = 0; i < s.length; i++) {
			h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
			h = (h << 13) | (h >>> 19);
		}
		const next = () => {
			h = Math.imul(h ^ (h >>> 16), 2246822507);
			h = Math.imul(h ^ (h >>> 13), 3266489909);
			h ^= h >>> 16;
			return h >>> 0;
		};
		const rng = new Rng([next(), next(), next(), next()]);
		// 最初の数回は偏るので捨てる
		for (let i = 0; i < 12; i++) rng.u32();
		return rng;
	}

	state(): RngState {
		return [this.a, this.b, this.c, this.d];
	}

	u32(): number {
		this.a >>>= 0;
		this.b >>>= 0;
		this.c >>>= 0;
		this.d >>>= 0;
		let t = (this.a + this.b) | 0;
		this.a = this.b ^ (this.b >>> 9);
		this.b = (this.c + (this.c << 3)) | 0;
		this.c = (this.c << 21) | (this.c >>> 11);
		this.d = (this.d + 1) | 0;
		t = (t + this.d) | 0;
		this.c = (this.c + t) | 0;
		return t >>> 0;
	}

	/** [0, 1) */
	float(): number {
		return this.u32() / 4294967296;
	}

	/** [0, n) の整数。 */
	int(n: number): number {
		return n <= 0 ? 0 : Math.floor(this.float() * n);
	}

	/** [lo, hi] の整数。 */
	range(lo: number, hi: number): number {
		return lo + this.int(hi - lo + 1);
	}

	/** 確率 p（0〜1）で true。 */
	chance(p: number): boolean {
		return this.float() < p;
	}

	/** 百分率 pct（0〜100）で true。 */
	percent(pct: number): boolean {
		return this.float() * 100 < pct;
	}

	pick<T>(list: readonly T[]): T {
		return list[this.int(list.length)];
	}

	/** 重みつきで1つ選ぶ。 */
	weighted<T>(list: readonly T[], weight: (x: T) => number): T {
		let total = 0;
		for (const x of list) total += Math.max(0, weight(x));
		let r = this.float() * total;
		for (const x of list) {
			r -= Math.max(0, weight(x));
			if (r < 0) return x;
		}
		return list[list.length - 1];
	}

	/** その場で切る（Fisher–Yates）。 */
	shuffle<T>(list: T[]): T[] {
		for (let i = list.length - 1; i > 0; i--) {
			const j = this.int(i + 1);
			[list[i], list[j]] = [list[j], list[i]];
		}
		return list;
	}
}

// HP が へったときの 字の色（ドラクエの 窓が 黄色・赤に なるのに ならう）。
// 半分より 上は 色なし（null）。半分で 黄色、へるほど 赤へ、2割を 切ったら 真っ赤。
// ダンジョンの ログの 字・HP の 数字・HP バーに 使う（ui/play.ts の updateStatus）。

const YELLOW = [255, 216, 74] as const;
const RED = [255, 77, 77] as const;

/** 黄色に なる HP の 割合（これより 上は 色なし）。 */
export const INK_FROM = 0.5;
/** 真っ赤に なる HP の 割合。 */
export const INK_RED = 0.2;

export const hpInk = (hp: number, maxHp: number): string | null => {
	const r = maxHp > 0 ? hp / maxHp : 0;
	if (r > INK_FROM) return null;
	const k = Math.min(1, Math.max(0, (INK_FROM - r) / (INK_FROM - INK_RED)));
	const [r0, g0, b0] = YELLOW.map((y, i) => Math.round(y + (RED[i] - y) * k));
	return `rgb(${r0}, ${g0}, ${b0})`;
};

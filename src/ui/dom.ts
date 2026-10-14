// DOM を組み立てる小さなヘルパ。

export const el = <K extends keyof HTMLElementTagNameMap>(
	tag: K,
	attrs: { class?: string; id?: string; text?: string; html?: string } = {},
	children: (HTMLElement | string)[] = [],
): HTMLElementTagNameMap[K] => {
	const e = document.createElement(tag);
	if (attrs.class) e.className = attrs.class;
	if (attrs.id) e.id = attrs.id;
	if (attrs.text !== undefined) e.textContent = attrs.text;
	if (attrs.html !== undefined) e.innerHTML = attrs.html;
	for (const c of children) e.append(c);
	return e;
};

/** 次のフレームまで待つ（CSS トランジションの開始用）。 */
export const nextFrame = (): Promise<void> =>
	new Promise((r) =>
		requestAnimationFrame(() => requestAnimationFrame(() => r())),
	);

/**
 * 字が 変わった ときだけ 書きかえる（毎コマ 同じ 字を 入れても スタイルの 計算が 走る。
 * 実況の ヘッダーなど 毎コマ 呼ぶ 所で 使う）。
 */
export const setText = (e: HTMLElement, text: string): void => {
	if (e.textContent !== text) e.textContent = text;
};

/** style の 1つ（CSS 変数も）を 変わった ときだけ 書きかえる（setText と 同じ わけ）。 */
export const setStyle = (e: HTMLElement, prop: string, value: string): void => {
	if (e.style.getPropertyValue(prop) !== value)
		e.style.setProperty(prop, value);
};

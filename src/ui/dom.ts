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

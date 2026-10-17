// イメージ図：場面の 上に 出す、説明の 絵（板どうしの つながり・近道の 地図 など）。
// - 横 1列の 札（絵と 名前）を 矢印で つなぐ。矢印には 一言と、取り消しの 判（「独立」など）。
// - 見た目だけ（保存・乱数に さわらない）。画面の ない ところ（シミュレーション）では 何も しない。
// - 絵は public/ の 歩行グラの 1コマ目（下向き。16×16）か、文字（AA）。

import { publicUrl } from "./assets";

export type CardNode = {
	label: string;
	/** 名前の 下の 小さな 一言（改行 可）。 */
	sub?: string;
	/** public/ からの 歩行グラ（32×64 の 2列 4段。1コマ目を 出す）。 */
	sprite?: string;
	/** 絵の かわりの 文字。 */
	aa?: string;
	/** ぷるぷる ゆれる（怒って いる）。 */
	shake?: boolean;
};

export type CardLink = {
	label: string;
	/** 矢印に 押す 判（あれば 矢印が うすく なる）。 */
	cut?: string;
};

export type CardSpec = {
	title: string;
	nodes: readonly CardNode[];
	/** nodes の あいだ（nodes.length − 1 本）。 */
	links: readonly CardLink[];
	/** 右下の 注（「ゼロ調べ」など）。 */
	note?: string;
};

export type CardRun = {
	/** 中身を 入れかえる（判を 押す・ゆらす など）。 */
	update(spec: CardSpec): void;
	end(): void;
};

const NONE: CardRun = { update: () => {}, end: () => {} };

const el = (cls: string, text?: string): HTMLElement => {
	const d = document.createElement("div");
	d.className = cls;
	if (text !== undefined) d.textContent = text;
	return d;
};

const art = (n: CardNode): HTMLElement => {
	const a = el("scene-card-art");
	if (n.sprite) {
		// 16×16 の 1コマを 3倍（48px）
		a.style.backgroundImage = `url("${publicUrl(n.sprite)}")`;
		a.style.backgroundSize = "96px 192px";
		a.style.backgroundPosition = "0 0";
	} else if (n.aa) a.textContent = n.aa;
	return a;
};

const fill = (box: HTMLElement, spec: CardSpec): void => {
	box.replaceChildren();
	box.appendChild(el("scene-card-title", spec.title));
	const row = el("scene-card-row");
	spec.nodes.forEach((n, i) => {
		if (i > 0) {
			const l = spec.links[i - 1];
			const link = el(`scene-card-link${l?.cut ? " cut" : ""}`);
			link.appendChild(el("scene-card-link-label", l?.label ?? ""));
			if (l?.cut) link.appendChild(el("scene-card-stamp", l.cut));
			row.appendChild(link);
		}
		const node = el(`scene-card-node${n.shake ? " shake" : ""}`);
		node.appendChild(art(n));
		node.appendChild(el("scene-card-label", n.label));
		if (n.sub) node.appendChild(el("scene-card-sub", n.sub));
		row.appendChild(node);
	});
	box.appendChild(row);
	if (spec.note) box.appendChild(el("scene-card-note", spec.note));
};

/** イメージ図を 出す（root は 画面の 上の 層 #ui。sceneFx.ts の fxRoot）。 */
export const showCard = (root: HTMLElement | null, spec: CardSpec): CardRun => {
	if (!root || typeof document === "undefined") return NONE;
	const box = el("scene-card");
	fill(box, spec);
	root.appendChild(box);
	void box.offsetWidth;
	box.classList.add("on");
	return {
		update: (s) => fill(box, s),
		end: () => {
			box.classList.remove("on");
			setTimeout(() => box.remove(), 250);
		},
	};
};

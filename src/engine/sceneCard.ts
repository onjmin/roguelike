// イメージ図：場面の 上に 出す 絵。2つの 形が ある。
// - 実物の 絵（PictureSpec）：台詞に 出てきた 物・所の 拡大図（広場の まとめ掲示板に 見出しの 紙が 貼って ある、
//   搭乗券の はしの 印、案内板の 字）。「見出し」と 言われても どこに どう ついて いる 物か 分からないので、その 絵を
//   出す（2026-10-18 作者「どういうところについている見出しか画像をもってこい」）。仕組みの 説明の 矢印図には しない。
// - 札と 矢印（CardSpec）：場面の 人が その場で 描いて 見せる 図（話の つなぎの ゼロ「図にしました！」。data/story/hooks.ts）
//   だけ。横 1列の 札で、矢印には 一言と、取り消しの 判。語りの 騒ぎの 規模の 段（町 → 日本 → 世界）には 使わない：
//   段は 台詞と 人の 動き（StoryPage の go・look・cut）で 見せる。
// - どちらも 見た目だけ（保存・乱数に さわらない）。画面の ない ところ（シミュレーション）では 何も しない。
// - 札の 絵は public/ の 歩行グラの 1コマ目（下向き。16×16）か、文字（AA）。実物の 絵は engine/assets.ts の 参照
//   （切り出し つき）を 何倍かに して 描く。

import { cropOf, loadImage, publicUrl } from "./assets";

/** 実物の 絵（拡大図）。 */
export type PictureSpec = {
	kind: "picture";
	title: string;
	/** 絵（engine/assets.ts の 参照。`#sx,sy,sw,sh` の 切り出し 可）。 */
	art: string;
	/** 倍率（既定 4）。 */
	scale?: number;
	/** 絵の 上に 貼って ある 紙（見出し・はり紙・書きこみ。改行 可）。strike は 書いて 消した あと。 */
	paper?: { text: string; strike?: boolean };
	/** 右下の 注。 */
	note?: string;
};

export type AnyCard = CardSpec | PictureSpec;

export const isPicture = (s: AnyCard): s is PictureSpec =>
	"kind" in s && s.kind === "picture";

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
	/** 中身を 入れかえる（判を 押す・ゆらす・紙を 書きかえる など）。 */
	update(spec: AnyCard): void;
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

/** 実物の 絵：切り出した 絵を scale 倍の canvas に 描き、その 上に 紙を 重ねる。 */
const fillPicture = (box: HTMLElement, spec: PictureSpec): void => {
	box.replaceChildren();
	box.classList.add("picture");
	box.appendChild(el("scene-card-title", spec.title));
	const pic = el("scene-pic");
	const scale = spec.scale ?? 4;
	const canvas = document.createElement("canvas");
	canvas.className = "scene-pic-art";
	pic.appendChild(canvas);
	void loadImage(spec.art).then((img) => {
		if (!img || !canvas.isConnected) return;
		const c = cropOf(spec.art) ?? {
			sx: 0,
			sy: 0,
			sw: img.width,
			sh: img.height,
		};
		canvas.width = c.sw * scale;
		canvas.height = c.sh * scale;
		const g = canvas.getContext("2d");
		if (!g) return;
		g.imageSmoothingEnabled = false;
		g.drawImage(img, c.sx, c.sy, c.sw, c.sh, 0, 0, c.sw * scale, c.sh * scale);
		// 絵が 来てから 幅が 決まる
		if (box.parentElement) fit(box, box.parentElement);
	});
	if (spec.paper) {
		const paper = el(
			`scene-paper${spec.paper.strike ? " strike" : ""}`,
			spec.paper.text,
		);
		pic.appendChild(paper);
	}
	box.appendChild(pic);
	if (spec.note) box.appendChild(el("scene-card-note", spec.note));
};

const fill = (box: HTMLElement, spec: AnyCard): void => {
	if (isPicture(spec)) {
		fillPicture(box, spec);
		return;
	}
	box.replaceChildren();
	box.classList.remove("picture");
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

/**
 * 画面の 幅に 収まらない 図（札が 4枚 並ぶ 湯温戦争 など。スマホ縦）は、縮めて 収める（--fit。左右 16px ずつ あける）。
 * 字を 折り返すと 札の 並びが くずれるので、並びは そのままで 図ごと 縮める。
 */
const fit = (box: HTMLElement, root: HTMLElement): void => {
	const room = root.clientWidth - 32;
	const w = box.offsetWidth;
	box.style.setProperty("--fit", w > room && w > 0 ? String(room / w) : "1");
};

/** イメージ図を 出す（root は 画面の 上の 層 #ui。sceneFx.ts の fxRoot）。 */
export const showCard = (root: HTMLElement | null, spec: AnyCard): CardRun => {
	if (!root || typeof document === "undefined") return NONE;
	const box = el("scene-card");
	fill(box, spec);
	root.appendChild(box);
	fit(box, root);
	void box.offsetWidth;
	box.classList.add("on");
	return {
		update: (s) => {
			fill(box, s);
			fit(box, root);
		},
		end: () => {
			box.classList.remove("on");
			setTimeout(() => box.remove(), 250);
		},
	};
};

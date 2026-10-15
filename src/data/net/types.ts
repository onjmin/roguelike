// キリコの 家の パソコンの「ネット」（ui/net/net.ts）の ページの 形。どの ページも ここで 作る 架空の 物で、
// 本物の ネットには つながない（オフラインでも いつも 開ける）。DOM も 保存も 使わない。

/** 1行の 中の かけら（ただの 字・ほかの ページへの リンク・同じ スレの レスへの 安価）。 */
export type Span =
	| { s: string }
	| { s: string; href: string }
	| { s: string; anchor: number };

/** スレの 書きこみ 1つ。 */
export type Post = {
	no: number;
	name: string;
	/** 日付の 行（「2026/10/14(水) 21:03:12.34」）。 */
	date: string;
	/** ID（8字）。 */
	id: string;
	/** 本文（1行ずつ）。 */
	lines: Span[][];
};

export type Node =
	| { t: "h"; text: string }
	| { t: "p"; spans: Span[]; small?: true }
	| {
			t: "link";
			href: string;
			text: string;
			/** 右に 小さく 出す 字（レスの 数・勢い・「過去ログ」）。 */
			note?: string;
			/** 過去ログ（沈んだ スレ）。色を かえる。 */
			kako?: true;
	  }
	| { t: "post"; post: Post }
	/** 小さな 四角の しるしつきの リンクの 表（90年代の ホームページの 目次）。 */
	| { t: "grid"; items: { href: string; text: string }[] }
	/**
	 * 写真の 置き場。pixels が あれば 小さな ドット絵（1字 1点、palette の 色。ui が キャンバスで くっきり 大きく 描く）、
	 * 無ければ 灰色の 四角に text。text は 絵の 名前（読み上げ用）。
	 */
	| {
			t: "photo";
			text: string;
			pixels?: readonly string[];
			palette?: Readonly<Record<string, string>>;
	  }
	| { t: "hr" };

/** ページの 見た目の 型（CSS の 色わけ）。 */
export type PageKind =
	| "portal"
	| "board"
	| "thread"
	| "matome"
	| "dic"
	| "news"
	| "tenki"
	| "abe"
	| "none";

export type Page = {
	url: string;
	title: string;
	kind: PageKind;
	nodes: Node[];
	/** 開いたときの 下の 帯の 字（無ければ「ページが表示されました」）。 */
	status?: string;
};

/** ページを 作る ときの 材料（ui/net/net.ts が 保存と 端末の 時計から 集める）。 */
export type NetEnv = {
	/** 帰りの 数（日ごとの スレの 入れかわりの 種）。 */
	seed: number;
	/** 町の 段（0〜7）。 */
	stage: number;
	year: number;
	m: number;
	d: number;
	/** 曜日（0=日〜6=土）。 */
	w: number;
	/** 時（0〜23）。 */
	hour: number;
};

export type Site = { home: string; pages: ReadonlyMap<string, Page> };

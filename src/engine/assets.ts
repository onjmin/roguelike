// 画像アセットの読み込みとキャッシュ。
//
// RPGEN の素材は unj-reze（GameMaker.tsx / lib/rpgen-assets.ts）と同じく
// rpgen-search の CDN を id で直リンクする。CDN は CORS を許可している。
// 実体ファイル名は検索 API の `id`（ハッシュ文字列）で決まる。

const RPGEN_CDN = "https://rpgen-search.pages.dev";

/** 単体スプライト（16x16 のマップチップ等）。 */
export const spriteUrl = (id: string) =>
	`${RPGEN_CDN}/data/images/sprites/${id}.png`;

/** 歩行グラ（RPGEN 形式: 16x16・2コマ×4方向＝32x64）。 */
export const sAnimUrl = (id: string) =>
	`${RPGEN_CDN}/data/images/sAnims/${id}.png`;

/** 効果音（mp3）。 */
export const soundUrl = (id: string) =>
	`${RPGEN_CDN}/data/audio/sound/${id}.mp3`;

/** public/ 配下のファイルを、GitHub Pages のサブパス配信でも解決できる URL にする。 */
export const publicUrl = (path: string) =>
	`${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;

/**
 * 素材参照を URL に解決する（末尾の `#sx,sy,sw,sh` 切り出し指定は除く）。
 * - `sp:<id>` … RPGEN スプライト
 * - `sa:<id>` … RPGEN 歩行グラ
 * - `pub:<path>` … public/ 配下（`pub:assets/rpg-reze/Base.png#0,48,16,16` のようにチップシートの1マスも指せる）
 * - `rt:<名前>` … 実行中に 作った 絵（setRuntimeImage。URL に せず そのまま 返す）
 * - それ以外はそのまま URL とみなす
 */
export const resolveRef = (ref: string): string => {
	const hash = ref.indexOf("#");
	const base = hash < 0 ? ref : ref.slice(0, hash);
	if (base.startsWith("sp:")) return spriteUrl(base.slice(3));
	if (base.startsWith("sa:")) return sAnimUrl(base.slice(3));
	if (base.startsWith("pub:")) return publicUrl(base.slice(4));
	return base;
};

export type Crop = { sx: number; sy: number; sw: number; sh: number };

const cropCache = new Map<string, Crop | null>();

/** 参照の切り出し指定（`#sx,sy,sw,sh`）。無ければ null。 */
export const cropOf = (ref: string): Crop | null => {
	const hit = cropCache.get(ref);
	if (hit !== undefined) return hit;
	const hash = ref.indexOf("#");
	let crop: Crop | null = null;
	if (hash >= 0) {
		const [sx, sy, sw, sh] = ref
			.slice(hash + 1)
			.split(",")
			.map(Number);
		if ([sx, sy, sw, sh].every((n) => Number.isFinite(n)))
			crop = { sx, sy, sw, sh };
	}
	cropCache.set(ref, crop);
	return crop;
};

/**
 * 参照の画像（切り出しがあればその部分）を、16px のマス (x, y) に
 * 下端そろえ・左右中央で描く。未読込なら false。
 * part で縦を分けて描ける：`cell` はマスの高さの中だけ、`over` はマスより上へはみ出した部分だけ。
 */
export const drawRefInCell = (
	ctx: CanvasRenderingContext2D,
	ref: string,
	x: number,
	y: number,
	cell = 16,
	part: "all" | "cell" | "over" = "all",
): boolean => {
	// 絵の決まっていない物は 描かない（1つの抜けで 毎コマ 例外になり、画面ごと止まらないように）
	if (!ref) return false;
	const img = getImage(ref);
	if (!img) return false;
	const c = cropOf(ref) ?? { sx: 0, sy: 0, sw: img.width, sh: img.height };
	const over = Math.max(0, c.sh - cell);
	const top = part === "cell" ? over : 0;
	const h = part === "over" ? over : c.sh - top;
	if (h > 0)
		ctx.drawImage(
			img,
			c.sx,
			c.sy + top,
			c.sw,
			h,
			x + (cell - c.sw) / 2,
			y + cell - c.sh + top,
			c.sw,
			h,
		);
	return true;
};

/** 画像がマスより上へはみ出すか（未読込で大きさが分からなければ false）。 */
export const overflowsCell = (ref: string, cell = 16): boolean => {
	if (!ref) return false;
	const c = cropOf(ref);
	if (c) return c.sh > cell;
	const img = getImage(ref);
	return !!img && img.height > cell;
};

type Entry = {
	img: HTMLImageElement;
	ok: boolean;
	failed: boolean;
	promise: Promise<HTMLImageElement | null>;
};

const cache = new Map<string, Entry>();
const listeners = new Set<() => void>();

/** どれかの画像の読み込みが終わるたびに呼ばれる（マップのキャッシュ描き直し用）。 */
export const onImageLoaded = (fn: () => void): (() => void) => {
	listeners.add(fn);
	return () => listeners.delete(fn);
};

// ───── 実行中に 作る 絵（`rt:<名前>`） ─────
// 遊びの 中で 描いた 絵（キリコの 家の イーゼルに 飾る 絵：ui/paint/paint.ts）を、ほかの 素材と 同じ
// 参照の 字で マスに 描けるように する。URL では ないので 読み込みは しない：setRuntimeImage で 置いた
// キャンバスを そのまま 返す（drawImage は キャンバスも 描ける。大きさは width・height を 見るだけ）。
// 置く までは getImage が null、loadImage は 置かれるのを 待つ。同じ キャンバスを 描き直したら もう 1回 呼ぶ
// （onImageLoaded の 聞き手に 知らせて、地図の キャッシュを 描き直させる）。

const runtimeImages = new Map<string, HTMLCanvasElement>();
const runtimeWaits = new Map<string, ((img: HTMLImageElement) => void)[]>();
const asImg = (c: HTMLCanvasElement) => c as unknown as HTMLImageElement;

/** `rt:<名前>` に キャンバスを 置く（置き直す）。 */
export const setRuntimeImage = (
	key: string,
	canvas: HTMLCanvasElement,
): void => {
	runtimeImages.set(key, canvas);
	for (const r of runtimeWaits.get(key) ?? []) r(asImg(canvas));
	runtimeWaits.delete(key);
	for (const fn of listeners) fn();
};

/** 画像の読み込みを始める（2回目以降はキャッシュ）。失敗したら null で解決する。 */
export const loadImage = (ref: string): Promise<HTMLImageElement | null> => {
	const url = resolveRef(ref);
	if (url.startsWith("rt:")) {
		const c = runtimeImages.get(url);
		if (c) return Promise.resolve(asImg(c));
		return new Promise((r) => {
			runtimeWaits.set(url, [...(runtimeWaits.get(url) ?? []), r]);
		});
	}
	const hit = cache.get(url);
	if (hit) return hit.promise;
	const img = new Image();
	img.crossOrigin = "anonymous";
	img.decoding = "async";
	const entry = { img, ok: false, failed: false } as Entry;
	entry.promise = new Promise((resolve) => {
		img.onload = () => {
			entry.ok = true;
			for (const fn of listeners) fn();
			resolve(img);
		};
		img.onerror = () => {
			entry.failed = true;
			console.warn("[assets] 画像を読み込めませんでした", url);
			resolve(null);
		};
	});
	img.src = url;
	cache.set(url, entry);
	return entry.promise;
};

/** 読み込み済みなら画像を返す（未読込なら読み込みを始めて null）。描画ループ用。 */
export const getImage = (ref: string): HTMLImageElement | null => {
	const url = resolveRef(ref);
	if (url.startsWith("rt:")) {
		const c = runtimeImages.get(url);
		return c ? asImg(c) : null;
	}
	const hit = cache.get(url);
	if (!hit) {
		void loadImage(ref);
		return null;
	}
	return hit.ok ? hit.img : null;
};

/** まとめて先読みする。1枚ずつの失敗は無視する。 */
export const preloadImages = async (refs: Iterable<string>): Promise<void> => {
	await Promise.all([...new Set(refs)].map((r) => loadImage(r)));
};

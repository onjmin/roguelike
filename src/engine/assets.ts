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
 */
export const drawRefInCell = (
	ctx: CanvasRenderingContext2D,
	ref: string,
	x: number,
	y: number,
	cell = 16,
): boolean => {
	// 絵の決まっていない物は 描かない（1つの抜けで 毎コマ 例外になり、画面ごと止まらないように）
	if (!ref) return false;
	const img = getImage(ref);
	if (!img) return false;
	const c = cropOf(ref);
	const w = c ? c.sw : img.width;
	const h = c ? c.sh : img.height;
	const dx = x + (cell - w) / 2;
	const dy = y + cell - h;
	if (c) ctx.drawImage(img, c.sx, c.sy, c.sw, c.sh, dx, dy, w, h);
	else ctx.drawImage(img, dx, dy);
	return true;
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

/** 画像の読み込みを始める（2回目以降はキャッシュ）。失敗したら null で解決する。 */
export const loadImage = (ref: string): Promise<HTMLImageElement | null> => {
	const url = resolveRef(ref);
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

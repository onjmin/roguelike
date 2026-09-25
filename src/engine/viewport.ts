// 画面の「いま実際に見えている範囲」を測って、CSS と描画に配る。
//
// スマホのブラウザは上や下にバー（URL 欄・ツールバー）を出す。ところが
// position: fixed / 100vh / window.innerHeight が指すのは「バーが引っこんだときの
// 大きい画面」なので、そのまま画面いっぱいに敷くと、端の何十 px かがバーの裏に潜る。
// そこに置いたボタン（右上の 🔇・☰ など）は見えず、タッチもできない。
//
// visualViewport は「見えている箱」（位置・大きさ）をそのまま教えてくれるので、
// それを測って CSS 変数 --app-x / --app-y / --app-w / --app-h に入れ、#app をその箱に
// ぴったり重ねる。画面の形で変える見た目（せまい・横持ち）も、レイアウトの画面ではなく
// この箱で決める（.narrow / .short-landscape）。
//
// visualViewport の無いブラウザでは innerWidth/Height を使う（CSS 側は svh/svw が控え）。

export type Viewport = {
	/** レイアウトの画面の左上から見た、見えている箱の位置（CSS 画素）。 */
	x: number;
	y: number;
	/** 見えている箱の大きさ（CSS 画素）。 */
	w: number;
	h: number;
};

/** いま見えている箱。中身は測り直すたびに書きかわる（参照はそのまま使える）。 */
export const viewport: Viewport = { x: 0, y: 0, w: 0, h: 0 };

const listeners = new Set<() => void>();

/** 見えている箱が変わったときに呼ばれる。戻り値を呼ぶと外れる。 */
export const onViewportChange = (fn: () => void): (() => void) => {
	listeners.add(fn);
	return () => {
		listeners.delete(fn);
	};
};

const measure = (): Viewport => {
	const fallback = { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
	const vv = window.visualViewport;
	if (!vv) return fallback;
	// ピンチで拡大しているあいだの visualViewport は「拡大して覗いている窓」なので、
	// これに合わせるとレイアウトごと縮んでしまう。そのときは触らない
	if ((vv.scale || 1) > 1.01) return fallback;
	const w = Math.round(vv.width);
	const h = Math.round(vv.height);
	// 測れないとき（0 を返す端末がある）は innerWidth/Height に任せる
	if (w < 1 || h < 1) return fallback;
	return { x: Math.round(vv.offsetLeft), y: Math.round(vv.offsetTop), w, h };
};

let waiting = 0;

const apply = (): void => {
	waiting = 0;
	const next = measure();
	if (
		next.x === viewport.x &&
		next.y === viewport.y &&
		next.w === viewport.w &&
		next.h === viewport.h
	)
		return;
	Object.assign(viewport, next);
	const style = document.documentElement.style;
	style.setProperty("--app-x", `${next.x}px`);
	style.setProperty("--app-y", `${next.y}px`);
	style.setProperty("--app-w", `${next.w}px`);
	style.setProperty("--app-h", `${next.h}px`);
	const cls = document.documentElement.classList;
	cls.toggle("narrow", next.w <= 340);
	cls.toggle("short-landscape", next.w > next.h && next.h <= 520);
	for (const fn of listeners) fn();
};

/** 次のフレームで測り直す（続けて呼ばれても 1 回にまとめる）。 */
export const syncViewport = (): void => {
	if (!waiting) waiting = requestAnimationFrame(apply);
};

const vv = window.visualViewport;
// バーの出入り（resize）だけでなく、見えている箱がずれる（scroll）のも拾う
vv?.addEventListener("resize", syncViewport);
vv?.addEventListener("scroll", syncViewport);
window.addEventListener("resize", syncViewport);
window.addEventListener("pageshow", syncViewport);
// 回した直後はまだ前の向きの大きさを返すブラウザがあるので、少しあとにも測り直す
window.addEventListener("orientationchange", () => {
	syncViewport();
	for (const ms of [100, 300, 600]) setTimeout(syncViewport, ms);
});

// 読みこんだ時点で 1 回測る（Screen などがすぐ viewport を読めるように）
apply();

// セーブの 改ざん よけ（中断セーブ・進み具合・町）。
//
// 中身の JSON の 前に 署名を 付けて しまう（`$1:<署名>:<JSON>`）。署名が 合わなければ 読まない（無かった ことに する）。
// 署名には 置き場所の 名前も まぜるので、別の 場所の 中身を 写しても 合わない。
// 手もとで 動く ゲームなので 本気で 解けば 破れる。localStorage を 手で 書きかえる くらいの チートを 止める ため。
//
// 署名の 無い 古い セーブは、まだ 一度も 署名して 書いて いない（SEALED_KEY が 無い）ときだけ 読む
// （この 版より 前に 遊んで いた 人の セーブ。次に 書くときに 署名が 付く）。

const TAG = "$1:";
const SALT = "kiriko-roguelike:ゼロ:やきう:2026";
/** 一度でも 署名して 書いたら 立てる（あとから 署名を はがした セーブを 古い セーブと 取りちがえない）。 */
const SEALED_KEY = "kiriko-roguelike/sealed";

/** 53bit の 混ぜ合わせ（cyrb53）。 */
const hash = (s: string): string => {
	let h1 = 0xdeadbeef;
	let h2 = 0x41c6ce57;
	for (let i = 0; i < s.length; i++) {
		const c = s.charCodeAt(i);
		h1 = Math.imul(h1 ^ c, 2654435761);
		h2 = Math.imul(h2 ^ c, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
	h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
	h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
};

const sign = (key: string, json: string): string =>
	hash(`${SALT}\n${key}\n${json}\n${json.length}`);

/** 署名を 付けた 文字列（そのまま setItem する）。 */
export const sealText = (key: string, json: string): string =>
	`${TAG}${sign(key, json)}:${json}`;

/** 署名を 付けて 書く（書けなければ 投げる。呼ぶ側の try/catch に まかせる）。 */
export const writeSealed = (key: string, json: string): void => {
	localStorage.setItem(key, sealText(key, json));
	try {
		if (localStorage.getItem(SEALED_KEY) !== "1")
			localStorage.setItem(SEALED_KEY, "1");
	} catch {
		// 立てられなくても 書けた ものは 書けた（次に 書くときに また 立てる）
	}
};

/** 署名を たしかめて 中身の JSON を 返す。無い・合わない なら null（読めなければ 投げる）。 */
export const readSealed = (key: string): string | null => {
	const raw = localStorage.getItem(key);
	if (!raw) return null;
	if (!raw.startsWith(TAG))
		return localStorage.getItem(SEALED_KEY) === "1" ? null : raw;
	const at = raw.indexOf(":", TAG.length);
	if (at < 0) return null;
	const json = raw.slice(at + 1);
	return raw.slice(TAG.length, at) === sign(key, json) ? json : null;
};

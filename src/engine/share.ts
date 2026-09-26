// リプレイを 人に わたす：残した リプレイ（engine/save.ts の SavedReplay）を 短い文字（共有コード）にして、
// URL の # 以降・テキスト・ファイルで 運ぶ。サーバーは 使わない（# 以降は ページを 配る側にも 送られない）。
//
// - 共有コード：「頭の文字」＋ JSON を deflate で 縮めて base64url にしたもの。
//   頭の文字は 形の版（1）と 縮めたか（z：縮めた、j：縮めていない）。縮める しくみの無い ブラウザでも 作れて 読めるように。
// - リンク：今の ページの URL ＋「#r=共有コード」。開くと main.ts が 読んで 見るか 聞く。
// - ゲームの中身の版は リプレイの builds に 入っている。版が ちがえば 見る前に 知らせる（途中で ずれたら そこまで。
//   昔の版は 置いていないので、割り切る）。

import { type SavedReplay, toReplay } from "./save";

/** リンクの # のあとの 印。 */
const HASH_KEY = "r=";

const toB64url = (bytes: Uint8Array): string => {
	let bin = "";
	for (let i = 0; i < bytes.length; i += 0x8000)
		bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
};

const fromB64url = (s: string): Uint8Array => {
	const bin = atob(s.replaceAll("-", "+").replaceAll("_", "/"));
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
};

const canZip = typeof CompressionStream === "function";

const pipe = async (
	bytes: Uint8Array,
	stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> =>
	new Uint8Array(
		await new Response(
			new Blob([bytes as BlobPart]).stream().pipeThrough(stream),
		).arrayBuffer(),
	);

/** リプレイ → 共有コード。 */
export const encodeShare = async (rp: SavedReplay): Promise<string> => {
	const json = new TextEncoder().encode(JSON.stringify(rp));
	if (!canZip) return `1j${toB64url(json)}`;
	return `1z${toB64url(await pipe(json, new CompressionStream("deflate-raw")))}`;
};

/**
 * 共有コード（リンクごとでも、前後に 空白や 改行が あっても よい）→ リプレイ。読めなければ null。
 */
export const decodeShare = async (
	text: string,
): Promise<SavedReplay | null> => {
	const s = text.replace(/\s+/g, "");
	const at = s.lastIndexOf(`#${HASH_KEY}`);
	const code = at >= 0 ? s.slice(at + 1 + HASH_KEY.length) : s;
	try {
		const head = code.slice(0, 2);
		let bytes = fromB64url(code.slice(2));
		if (head === "1z") {
			if (typeof DecompressionStream !== "function") return null;
			bytes = await pipe(bytes, new DecompressionStream("deflate-raw"));
		} else if (head !== "1j") return null;
		return toReplay(JSON.parse(new TextDecoder().decode(bytes)));
	} catch {
		return null;
	}
};

/** 共有コード → 今の ページで 開く リンク。 */
export const shareUrl = (code: string): string =>
	`${location.origin}${location.pathname}#${HASH_KEY}${code}`;

/** 開いた リンクに 共有コードが あれば 取り出して、アドレス欄からは 消す（読みなおしで もう一度 出ないように）。 */
export const takeSharedHash = (): string | null => {
	if (!location.hash.startsWith(`#${HASH_KEY}`)) return null;
	const code = location.hash.slice(1 + HASH_KEY.length);
	history.replaceState(null, "", `${location.pathname}${location.search}`);
	return code || null;
};

/** 書き出す ファイルの 名前（kiriko-replay-B5-20260926.txt など）。 */
export const shareFileName = (rp: SavedReplay): string => {
	const d = new Date(rp.at);
	const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
	return `kiriko-replay-${rp.kind === "clear" ? "clear" : `B${rp.depth}`}-${ymd}.txt`;
};

/** テキストを ファイルとして 保存させる（中身は リンク。開いて 貼れば 見られる）。 */
export const saveTextFile = (name: string, text: string): void => {
	const url = URL.createObjectURL(
		new Blob([`${text}\n`], { type: "text/plain" }),
	);
	const a = document.createElement("a");
	a.href = url;
	a.download = name;
	document.body.appendChild(a);
	a.click();
	a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
};

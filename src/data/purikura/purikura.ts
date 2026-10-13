// ゲームセンター「連コ」の プリクラ（ui/purikura/purikura.ts）の 決まり。
// - 撮れるのは キリコと、喫茶で 親しく なった 人（ui/village/cafe.ts の cafeBonds）2人まで。
// - 1枚は 組み立ての 手だけ（だれ・背景・ポーズ・スタンプ・日付）を 字に して 覚える。絵は 覚えず、見る たびに 描き直す。
// - プリ帳は 新しい 順に 8枚まで（localStorage の kiriko-roguelike/purikura。ui 側で 読み書き）。

import { CAST, KIRIKO_WALK } from "../people/cast";
import { type Cast, MOBS, type MobId } from "../people/mobs";
import type { Speaker } from "../story/quotes";

/** 写真の 大きさ（板の 上では 1倍。シールの 台紙では 半分）。 */
export const PURI_W = 160;
export const PURI_H = 100;
/** キリコの ほかに 入れる 人数。 */
export const PURI_WITH_MAX = 2;
/** 1枚に はれる スタンプの 数。 */
export const PURI_STAMP_MAX = 20;
/** プリ帳に 残す 枚数。 */
export const PURI_KEEP = 8;

export const PURI_BGS: readonly string[] = [
	"ハート",
	"星空",
	"おんJタウン",
	"草原",
	"夜の　湾岸",
];

export const PURI_POSES: readonly string[] = [
	"ピース",
	"ジャンプ",
	"ぎゅっ",
	"ななめ",
];

/** スタンプ（番号が 保存の 字。並びを かえない）。 */
export const PURI_STAMPS: readonly string[] = [
	"ハート",
	"星",
	"草",
	"ぷゆゆ",
	"ズッ友",
	"おんJ",
];

export type PuriStamp = { k: number; x: number; y: number };

export type PuriPhoto = {
	/** キリコの ほかに 写る 人（喫茶で 親しく なった 仲間・住人）。 */
	with: Cast[];
	bg: number;
	pose: number;
	/** 撮った 日（20261014 の 形）。 */
	date: number;
	stamps: PuriStamp[];
};

// ───────────────── 人 ─────────────────

export const isPuriCast = (v: unknown): v is Cast =>
	typeof v === "string" && (v in CAST || v in MOBS);

const isSpeaker = (w: Cast): w is Speaker => w in CAST;

/** 名前（一覧と プリ帳の 欄）。 */
export const puriName = (w: Cast): string =>
	isSpeaker(w) ? CAST[w].name : MOBS[w as MobId].name;

/** 歩行グラ（写真に 大きく 描く）。"kiriko" は キリコ。 */
export const puriWalk = (w: Cast | "kiriko"): string =>
	w === "kiriko"
		? KIRIKO_WALK
		: isSpeaker(w)
			? CAST[w].walk
			: MOBS[w as MobId].sprite;

/** 写る 並び（左から）。2人なら キリコが 左、3人なら キリコが まんなか。 */
export const puriLineup = (p: {
	with: readonly Cast[];
}): (Cast | "kiriko")[] =>
	p.with.length === 2
		? [p.with[0], "kiriko", p.with[1]]
		: ["kiriko", ...p.with];

// ───────────────── 日付 ─────────────────

export const puriDate = (d: Date): number =>
	d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

/** 写真の すみの 日付（2026.10.14）。 */
export const puriDateText = (n: number): string => {
	const y = Math.floor(n / 10000);
	const m = Math.floor(n / 100) % 100;
	const d = n % 100;
	return `${y}.${String(m).padStart(2, "0")}.${String(d).padStart(2, "0")}`;
};

// ───────────────── 保存の 字 ─────────────────
// 「だれ.だれ|背景|ポーズ|日付|スタンプ」。スタンプは 1つ 5字（種類 1字 + x・y を 36進 2字ずつ）。

const b36 = (n: number): string => n.toString(36).padStart(2, "0");

export const encodePhoto = (p: PuriPhoto): string =>
	[
		p.with.join("."),
		p.bg,
		p.pose,
		p.date,
		p.stamps.map((s) => `${s.k}${b36(s.x)}${b36(s.y)}`).join(""),
	].join("|");

const int = (s: string, lo: number, hi: number): number | null => {
	if (!/^\d+$/.test(s)) return null;
	const n = Number(s);
	return n >= lo && n <= hi ? n : null;
};

const validDate = (n: number): boolean => {
	const m = Math.floor(n / 100) % 100;
	const d = n % 100;
	return m >= 1 && m <= 12 && d >= 1 && d <= 31;
};

/** 読めない 字は null（こわれた 保存は 捨てる）。 */
export const decodePhoto = (raw: unknown): PuriPhoto | null => {
	if (typeof raw !== "string") return null;
	const parts = raw.split("|");
	if (parts.length !== 5) return null;
	const [w, bgS, poseS, dateS, st] = parts;
	const who = w === "" ? [] : w.split(".");
	if (who.length > PURI_WITH_MAX || !who.every(isPuriCast)) return null;
	if (new Set(who).size !== who.length) return null;
	const bg = int(bgS, 0, PURI_BGS.length - 1);
	const pose = int(poseS, 0, PURI_POSES.length - 1);
	const date = int(dateS, 10000101, 99991231);
	if (bg === null || pose === null || date === null || !validDate(date))
		return null;
	if (st.length % 5 !== 0 || st.length / 5 > PURI_STAMP_MAX) return null;
	const stamps: PuriStamp[] = [];
	for (let i = 0; i < st.length; i += 5) {
		const k = int(st[i], 0, PURI_STAMPS.length - 1);
		const xs = st.slice(i + 1, i + 3);
		const ys = st.slice(i + 3, i + 5);
		if (k === null || !/^[0-9a-z]{2}$/.test(xs) || !/^[0-9a-z]{2}$/.test(ys))
			return null;
		const x = Number.parseInt(xs, 36);
		const y = Number.parseInt(ys, 36);
		if (x >= PURI_W || y >= PURI_H) return null;
		stamps.push({ k, x, y });
	}
	return { with: who as Cast[], bg, pose, date, stamps };
};

/** プリ帳（新しい 順）。 */
export const encodeAlbum = (list: readonly PuriPhoto[]): string =>
	JSON.stringify({ v: 1, list: list.slice(0, PURI_KEEP).map(encodePhoto) });

export const decodeAlbum = (raw: unknown): PuriPhoto[] => {
	if (typeof raw !== "string") return [];
	try {
		const o = JSON.parse(raw);
		if (o?.v !== 1 || !Array.isArray(o.list)) return [];
		return o.list
			.map(decodePhoto)
			.filter((p: PuriPhoto | null): p is PuriPhoto => p !== null)
			.slice(0, PURI_KEEP);
	} catch {
		return [];
	}
};

/** 新しい 1枚を 先頭に（古い ものから 押し出す）。 */
export const addToAlbum = (
	list: readonly PuriPhoto[],
	p: PuriPhoto,
): PuriPhoto[] => [p, ...list].slice(0, PURI_KEEP);

// ───────────────── 字 ─────────────────

export const PURI_TEXT = {
	// 1回 PURI_YEN 円（2026-10-14 作者：「お金 消費できる ように なったので 消費に 寄せる」）
	menu: ["撮る（400円）", "プリ帳を　見る", "やめる"],
	short: "お金が　たりない。\n（1回　400円）",
	title: "プリクラ",
	album: "プリ帳",
	pickFirst: "だれと　撮る？",
	pickSecond: "もう　1人　よぶ？",
	alone: "キリコ　ひとりで",
	asIs: "このまま　撮る",
	none: "いっしょに　撮れる　人は　まだ　いない。\n喫茶で　親しく　なると　いいかも。",
	hintBg: "←→ 背景　A・タップ 撮る　B 2回 やめる",
	hintCount: "B 2回 やめる",
	hintDeco: "十字 うごく　A・タップ はる　B 2回 完成",
	hintSheet: "A・タップ とじる",
	hintAlbum: "←→ めくる　B とじる",
	bg: "背景：{name}",
	shoot: "撮る",
	posing: "つぎは　{pose}！",
	flash: "パシャ！",
	deco: "落書き　タイム！",
	undo: "もどす",
	done: "できた",
	full: "もう　はれない",
	quit1: "もう　1回　B で　やめる",
	deco1: "もう　1回　B で　できあがり",
	sheet: "シールが　出てきた！",
	quit: "撮るのを　やめた。",
	got: "シールが　出てきた。\nプリ帳に　1枚　はった。",
	gotPreview: "シールが　出てきた。\n（下見なので　プリ帳には　はらない）",
	alone1: "キリコは　できた　シールを\nしばらく　ながめていた。",
	empty: "プリ帳は　まだ　まっしろだ。",
	page: "{n}／{all}　{date}",
} as const;

/**
 * 撮った あとの ひとこと（1人 1窓）。その人の 口ぐせで（村の 話・喫茶の 話と 同じ 声）。
 * ぷゆゆの 文末の 顔は 窓に 出さない（絵文字に なる）。
 */
export const PURI_LINES: Record<Cast, string> = {
	roze: "盛れてるアル。\n……目が　大きいのは　常識アル",
	shiyo: "べ、べつに　撮りたかった\nわけじゃ　ないわよ。……1枚　ちょうだい",
	feris: "わ〜、キリコ　目が　キラキラ〜。\n私も　盛れてる〜？",
	zero: "保存しました。……スレと\nちがって、これは　沈みませんね",
	nanj: "なんやこれ、目　でかすぎやろ。\n……草。1枚　もらっとくわ",
	puyu: "ぼくちん、うつってゆ。\n……おめめ、きらきらゆ",
	nichie: "日付、日曜日に　して\nほしかったニィ……",
	panmatsu: "……植民地の　記念写真だ。\nパン板にも　はっておく",
	ngoane: "かわいく　撮れたンゴねぇ……\nフェリスちゃんにも　見せるンゴ",
	onsu: "おんSにも　はるのよぉ！\n……だれか　見て　くれるかしら",
	onchan: "ちょっとだけ　盛れただおん",
	yayapoji: "盛れすぎると、\nこわいんだ……",
	mujje: "ホゲェ！",
	asakonro: "うち、ちょっと　焦げて\nうつってるもん！",
	jtleman: "ふむ。君の　村の　記念に\n1枚　もらって　おこう",
	miaumiau: "シールで　おんJを\n侵略するぷ！",
	rino: "……悪くない。\n写真は　以上だ",
	aru: "先輩と　プリクラ……！\n一生の　宝物です！",
	proto: "これが　プリクラ、か。\n……学習したゼロ",
	ren: "やっほー、盛れてる！\n次の　更新で　目、もっと　光らせる！",
	hinary: "プリクラの　盛れ方を\n研究したいと　思います",
	shobon: "……こういうの、なんJでは\n撮らなかったな。どうも",
};

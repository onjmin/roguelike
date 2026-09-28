// 音楽室の ピアノ（ui/piano.ts）。プレイヤーが 1オクターブ（12音）の 鍵盤を 自由に 弾ける。
// 「ガイド」を えらぶと 劇中の 曲の 主旋律（MML の @0。engine/audio.ts の melodyOf）の 次の 音の 鍵盤が 光る
// （旋律は 12音に 折りたたむ。オクターブは 動かさない）。
// 曲は 自動では 鳴らない（押した 音だけ 鳴る）。

/** ガイドで 弾ける 曲（bgm は data/bgm.ts の 名前。need は 持ち帰った 板で ふえる）。 */
export const PIANO_GUIDES: readonly {
	bgm: string;
	name: string;
	need?: string;
}[] = [
	{ bgm: "town", name: "保守村" },
	{ bgm: "title", name: "蓄音キリコ" },
	{ bgm: "ruins", name: "朽ちた　まとめ跡" },
	{ bgm: "stone", name: "datの　石室" },
	{ bgm: "shallow3", name: "過去ログ倉庫" },
	{ bgm: "deq_laundry", name: "乾燥機が　まわるあいだ" },
	{ bgm: "deq_sea", name: "水底に　さす光" },
	{ bgm: "retro", name: "名無し155の　曲" },
	{ bgm: "sad", name: "落ちた　スレ" },
	{ bgm: "ending", name: "つづきの　原盤", need: "main" },
];

/** 持ち帰った 板で 弾ける ガイドの 曲。 */
export const pianoGuides = (cleared: readonly string[]) =>
	PIANO_GUIDES.filter((t) => !t.need || cleared.includes(t.need));

/** 鍵盤の 音名（ド〜シ。半音は ♯）。 */
export const KEY_NAMES: readonly string[] = [
	"ド",
	"ド♯",
	"レ",
	"レ♯",
	"ミ",
	"ファ",
	"ファ♯",
	"ソ",
	"ソ♯",
	"ラ",
	"ラ♯",
	"シ",
];

/** 黒鍵か（半音）。 */
export const isBlack = (k: number): boolean =>
	[1, 3, 6, 8, 10].includes(((k % 12) + 12) % 12);

/** 鍵盤の いちばん 左の ド（MIDI 番号。真ん中の ド）。鍵盤は ここから 12音だけ。 */
export const PIANO_BASE = 60;

/** 音名（0＝ド〜11＝シ）。ガイドの 旋律を 12鍵に 折りたたむ。 */
export const pitchClass = (midi: number): number => ((midi % 12) + 12) % 12;

/** ピアノを 調べた ときの 選択肢。 */
export const PIANO_MENU = ["弾いて　みる", "ガイドで　弾く", "やめる"] as const;

/** ガイドの 曲を 最後まで 弾けた。 */
export const PIANO_DONE = "客席から、ぱちぱちと　拍手。";

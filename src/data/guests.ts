// 村の 施設に 来ている 住人の 文（だれが どこに いるかは ui/guests.ts が 帰りごとに 決める）。
// 村の 窓と 同じ 決まり：1行は 全角22字・2行まで、1人 1〜2窓。キリコは しゃべらない。
// 住人は 帰りごとに、いつもの 家の まわり・音楽室（客席。歌う 子は ステージ）・本屋か 図書館（立ち読み）・
// 銭湯（女湯の 住人と ジェイトルマン。文は data/bath.ts）の どこかに いる。

import type { MobId } from "./mobs";

/** 音楽室の 客席で 聞いている 住人。 */
export const MUSIC_GUESTS: Partial<Record<MobId, readonly string[]>> = {
	puyu: ["ぷゆゆも　ピアノ　ききに\nきたの🥺"],
	nichie: ["週末だけの　ピアノだニィ！\n……月曜が　来ないで　ほしいニィ"],
	panmatsu: ["演奏の　あとは　パンだ。\n……拍手より　ふっくら　している"],
	ngoane: ["フェリスちゃんにも　聞かせたい\nンゴねぇ……"],
	onsu: ["おんSにも　ピアノが　あれば\nよかったのにぃ……"],
	onchan: ["ここの　ピアノ、\nいい　音が　するおん"],
	yayapoji: ["演奏が　はじまらないまま\n終わるのも、好きなんだ"],
	mujje: ["ホゲェ……♪"],
	asakonro: ["うちも　拍手で\n盛りあげるもん！"],
	jtleman: ["名犬Jは　演奏が　はじまると\n眠ってしまうのだ"],
	miaumiau: ["音楽で　おんJを\n侵略するぷ！"],
	proto: ["演奏の　テンポを　計測中ゼロ。\n……ゆらぎ　0.3％ゼロ"],
	hinary: ["拍手の　回数を\n研究しています"],
};

/** 音楽室の ステージで 歌う 子（レンの 文は data/rooms.ts の PIANO_MSG）。 */
export const STAGE_SINGERS = ["ren", "rino", "aru"] as const;
export type StageSinger = (typeof STAGE_SINGERS)[number];

export const STAGE_LINES: Record<
	Exclude<StageSinger, "ren">,
	readonly string[]
> = {
	rino: ["今日は　リハだ。\n……聞くのは　タダに　しといてやる"],
	aru: ["ピアノに　合わせて　歌う\n練習です。……動画に　するかも"],
};

/** 本屋・図書館で 立ち読み している 住人（ヒナリーは 図書館なら 読書の 机で data/rooms.ts の LIBRARY_HINARY）。 */
export const BOOKS_GUESTS: Partial<Record<MobId, readonly string[]>> = {
	puyu: ["ぷゆゆ、字　読めないけど\n絵を　見てるの🥺"],
	nichie: ["日曜日が　7回　ある\n曜日の　本、さがしてるニィ"],
	panmatsu: ["パンの　本は　どこだ。\n……ぜんぶ　パンの　本で　いいのに"],
	ngoane: ["恋の　本を　さがしてるンゴ。\n……フェリスちゃんが　出てくる　やつ"],
	onsu: ["おんSの　本、置いてないのぉ！？\n……ふ、ふん"],
	onchan: ["やきうの　本を　読んでるおん"],
	yayapoji: ["引き分けの　試合だけ　集めた\n本が　あるんだ"],
	mujje: ["ホゲェ……？\n（本を　さかさに　持っている）"],
	asakonro: ["料理の　本、読んでるもん。\n……焦がさない　コツ、のってない"],
	jtleman: ["犬の　しつけの　本だ。\n……名犬Jには　いらないがね"],
	miaumiau: ["侵略の　しかたの　本、\nないぷ？"],
	rino: ["歌詞の　本、立ち読み中。\n……金は　払わない"],
	aru: ["サムネの　作り方の　本を……\nあ、見ないでください"],
	proto: ["辞典を　1.4秒で　読了ゼロ。\n……誤字　0件ゼロ"],
	ren: ["アップデートの　本　ないかな〜？\n……あ、これ　マンガだ！"],
	hinary: ["監修した　ページを\n確認しています"],
};

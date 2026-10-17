// 村の 施設に 来ている 住人の 文（だれが どこに いるかは ui/village/guests.ts が 帰りごとに 決める）。
// 村の 窓と 同じ 決まり：1行は 全角22字・2行まで、1人 1〜2窓。キリコも 話してよい（吾輩・ンゴ）。
// 住人は 帰りごとに、いつもの 家の まわり・音楽室（客席。歌う 子は ステージ）・本屋か 図書館（立ち読み）・
// 銭湯（女湯の 住人と ジェイトルマン。文は data/town/bath.ts）の どこかに いる。

import type { MobId } from "./mobs";

/** 音楽室の 客席で 聞いている 住人。 */
export const MUSIC_GUESTS: Partial<Record<MobId, readonly string[]>> = {
	puyu: ["ぷゆゆもピアノききに\nきたの🥺"],
	nichie: ["週末だけのピアノだニィ！\n……月曜が来ないでほしいニィ"],
	panmatsu: ["演奏のあとはパンだ。\n……拍手よりふっくらしている"],
	ngoane: ["フェリスちゃんにも聞かせたい\nンゴねぇ……"],
	onsu: ["おんSにもピアノがあれば\nよかったのにぃ……"],
	onchan: ["ここのピアノ、\nいい音がするおん"],
	yayapoji: ["演奏がはじまらないまま\n終わるのも、好きなんだ"],
	mujje: ["ホゲェ……♪"],
	asakonro: ["うちも拍手で\n盛りあげるもん！"],
	jtleman: ["名犬Jは演奏がはじまると\n眠ってしまうのだ"],
	miaumiau: ["音楽でおんJを\n侵略するぷ！"],
	proto: ["演奏のテンポを計測中ゼロ。\n……ゆらぎ0.3％ゼロ"],
	hinary: ["拍手の回数を\n研究しています"],
};

/** 音楽室の ステージで 歌う 子（レンの 文は data/town/rooms.ts の PIANO_MSG）。 */
export const STAGE_SINGERS = ["ren", "rino", "aru"] as const;
export type StageSinger = (typeof STAGE_SINGERS)[number];

export const STAGE_LINES: Record<
	Exclude<StageSinger, "ren">,
	readonly string[]
> = {
	rino: ["今日はリハだ。\n……聞くのはタダにしといてやる"],
	aru: ["ピアノに合わせて歌う\n練習です。……動画にするかも"],
};

/** 本屋・図書館で 立ち読み している 住人（ヒナリーは 図書館なら 読書の 机で data/town/rooms.ts の LIBRARY_HINARY）。 */
export const BOOKS_GUESTS: Partial<Record<MobId, readonly string[]>> = {
	puyu: ["ぷゆゆ、字読めないけど\n絵を見てるの🥺"],
	nichie: ["日曜日が7回ある\n曜日の本、さがしてるニィ"],
	panmatsu: ["パンの本はどこだ。\n……ぜんぶパンの本でいいのに"],
	ngoane: ["恋の本をさがしてるンゴ。\n……フェリスちゃんが出てくるやつ"],
	onsu: ["おんSの本、置いてないのぉ！？\n……ふ、ふん"],
	onchan: ["やきうの本を読んでるおん"],
	yayapoji: ["引き分けの試合だけ集めた\n本があるんだ"],
	mujje: ["ホゲェ……？\n（本をさかさに持っている）"],
	asakonro: ["料理の本、読んでるもん。\n……焦がさないコツ、のってない"],
	jtleman: ["犬のしつけの本だ。\n……名犬Jにはいらないがね"],
	miaumiau: ["侵略のしかたの本、\nないぷ？"],
	rino: ["歌詞の本、立ち読み中。\n……金は払わない"],
	aru: ["サムネの作り方の本を……\nあ、見ないでください"],
	proto: ["辞典を1.4秒で読了ゼロ。\n……誤字0件ゼロ"],
	ren: ["アップデートの本ないかな〜？\n……あ、これマンガだ！"],
	hinary: ["監修したページを\n確認しています"],
};

// ネタスレの 遊び（グラウンド・碁会所・保守道場・ageジム・ゲームセンター）の 遊びの 名前。
// data/village/facilities.ts の FacilityRoom.plays・OutdoorThing.play に この 型を 足し、ui/facilities.ts は
// isNetaPlay なら ui/neta.ts の netaPlay に まかせる（共有の 分岐は 1行ずつ）。DOM も 保存も 使わない。

export const NETA_PLAYS = [
	"yakyu", // グラウンドの 三塁側の ベンチ：ランダム野球（ui/netaYakyu.ts）
	"kabe", // グラウンドの 外野の 5割の壁（5割の ときだけ しゃべる）
	"othello", // 碁会所の リバーシ盤（ui/netaOthello.ts。画面は 一般名の リバーシ）
	"sk", // 保守道場の 文机：!sk 習字（ui/netaSk.ts）
	"fukkin", // ageジムの 腹筋台：ID腹筋（ui/netaFukkin.ts）
	"comma", // ゲームセンターの コンマの 台（ui/netaComma.ts）
] as const;

export type NetaPlay = (typeof NETA_PLAYS)[number];

export const isNetaPlay = (p: string | undefined): p is NetaPlay =>
	p !== undefined && (NETA_PLAYS as readonly string[]).includes(p);

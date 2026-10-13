// ネタスレの 遊び（グラウンド・碁会所・おんJ道場・ageジム・ゲームセンター）の 遊びの 名前。
// data/village/facilities.ts の FacilityRoom.plays・OutdoorThing.play に この 型を 足し、ui/village/facilities.ts は
// isNetaPlay なら ui/neta/neta.ts の netaPlay に まかせる（共有の 分岐は 1行ずつ）。DOM も 保存も 使わない。

export const NETA_PLAYS = [
	"yakyu", // グラウンドの 三塁側の ベンチ：ランダム野球（ui/neta/netaYakyu.ts）
	"kabe", // グラウンドの 外野の 5割の壁（5割の ときだけ しゃべる）
	"othello", // 碁会所の リバーシ盤（ui/neta/netaOthello.ts。画面は 一般名の リバーシ）
	"sk", // おんJ道場の 文机：!sk 習字（ui/neta/netaSk.ts）
	"fukkin", // ageジムの 腹筋台：ID腹筋（ui/neta/netaFukkin.ts）
	"comma", // ゲームセンターの コンマの 台（ui/neta/netaComma.ts）
] as const;

export type NetaPlay = (typeof NETA_PLAYS)[number];

export const isNetaPlay = (p: string | undefined): p is NetaPlay =>
	p !== undefined && (NETA_PLAYS as readonly string[]).includes(p);

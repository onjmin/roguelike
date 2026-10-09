// おんJ高校の 部室棟（段4〜。新市街の 北の はし x40〜52 y0〜2。STORY.md §5.75）。部は どれも 部員 1人＝部長。
// 人狼部（ワードウルフ）・お糸会かき部（うろ覚え）・放送部（ぬとらじ）・ボカロ部・ゲーム制作部と 廊下の 合唱部・帰宅部。
// 遊べる 物は room.plays の "bushitsu"（ui/bushitsu.ts）。文と 人は data/bushitsu.ts。
// 段7 でも 外観は かえない（町が 都市に なっても 部室棟だけ 建てかわらない）。
// 絵は 同梱の Base.png・rpgen-interior.png と、scripts/make-bushitsu.mjs が 作る public/sprites/bushitsu.png（bs・bsCell）。
// ここからは facilities.ts の 値を 読まない（facilities.ts が ここを 読む）。

import {
	BS_DOOR,
	BS_OUTDOOR,
	BS_STAFF,
	BS_THING_LINES,
	nutoOnAir,
} from "../bushitsu";
import { bs, bsCell } from "../bushitsuSheet";
import { nowHour, today } from "../calendar";
import type { Facility, FacilityPerson, RoomLook } from "./facilities";
import { ri, riCell } from "./rpgenArt";
import { base, basePx } from "./tiles";

const look = (
	floor: string,
	floorColor: string,
	up: string,
	low: string,
	wallColor: string,
): RoomLook => ({ floor, floorColor, up, low, wallColor });
/** 台（台ごしに 向こうの 人と 話せる。人の となりの 台には 調べる 物を 置かない）。 */
const ctr = <T extends object>(t: T) => ({ ...t, counter: true });
/** 窓（Base.png。facilities.ts の WINDOW と 同じ）・時計・はり紙。 */
const WINDOW = basePx(48, 1382);
const CLOCK = base(7, 507);
const PAPER = basePx(32, 1446);

/** 部長（BS_STAFF の 名前・歩行グラ・セリフ）を 部屋の 人に する。 */
const staff = (
	who: keyof typeof BS_STAFF,
	at: FacilityPerson["at"],
	dir: FacilityPerson["dir"],
): FacilityPerson => ({
	id: `bs_${who}`,
	walk: BS_STAFF[who].walk,
	at,
	dir,
	name: BS_STAFF[who].name,
	lines: BS_STAFF[who].lines,
});

export const BUSHITSU: Facility = {
	id: "bushitsu",
	name: "おんJ高校　部室棟",
	from: 4,
	at: [40, 0],
	// 白い 壁と 腰板（Base.png 77・78 行の 0 列）・青い 瓦の 軒（84 行 2 列）。扉の 左に 縦長の 校札、右に 時計と 小窓
	look: {
		kind: "grid",
		rows: ["eeeeeeeeeeeee", "WwWwWwwcWwWwW", "lllplnDmllgll"],
		door: "D",
		keys: {
			e: [base(2, 84)],
			w: [base(0, 77)],
			W: [base(0, 77), WINDOW],
			c: [base(0, 77), CLOCK],
			l: [base(0, 78)],
			p: [base(0, 78), bs("posterOut")],
			// 16x32（上の マスへ はみ出す）
			n: [base(0, 78), bs("kosatsu")],
			// 茶色の 引き戸（16x32）
			D: [base(0, 78), base(7, 77, 1, 2)],
			m: [base(0, 78), WINDOW],
			g: [base(0, 78), bs("graffiti")],
		},
	},
	door: BS_DOOR,
	doorSe: "slideDoor",
	room: {
		// 板の 床と 白い 壁（本館と 同じ 腰板）
		look: look(base(0, 46), "#b8905a", base(1, 77), base(1, 78), "#e8e4dc"),
		rows: [
			"###############################",
			"#HWHaHHKLMHfTHWHOHHHRrHWWHWHeH#",
			"#hh1hhQklj2hmh3hhJbhhh4hhhh5hh#",
			"#_ccc_.....*.,,,,,.;;;;S.:::::#",
			"#_[=]_..E....g{|},.Y;;;;.:67:A#",
			"#_vvv_.p*.*..,,,,,.;<^>;.:89::#",
			"#_____...*...,,,,,.;;;;;.:::::#",
			"#......s.....................w#",
			"#.............................#",
			"#x...........Zz...............#",
			"###############DD##############",
		],
		tiles: (kit) => ({
			// 部ごとの 床（通れる）：人狼部＝畳・放送部＝灰の じゅうたん・ボカロ部＝白い タイル・ゲーム制作部＝濃い 板・お絵かき＝絵の具の しみ
			_: kit.floor(ri("flTatami")),
			",": kit.floor(base(3, 48)),
			";": kit.floor(ri("flWhite")),
			":": kit.floor(ri("flDarkWood")),
			"*": kit.floor(bs("paint")),
			// 人狼部：合言葉の はり紙・札・机（3マス）と いす 6つ（5つは 空き）
			a: kit.up(ri("memo")),
			"1": kit.low(bs("plateJinro")),
			c: kit.floor(ri("flTatami"), ri("chairDarkDown")),
			v: kit.floor(ri("flTatami"), ri("chairDarkUp")),
			"[": kit.on(ri("flTatami"), riCell("tableLong", 0, 0)),
			"=": kit.on(ri("flTatami"), riCell("tableLong", 1, 0)),
			"]": kit.on(ri("flTatami"), riCell("tableLong", 2, 0)),
			// お糸会かき部：落書きの 黒板（3×2。上段は ふちだけ）・額の 絵・札・イーゼル（16x32）・パレットの 台
			K: kit.up(bs("bbTL")),
			L: kit.up(bs("bbTM")),
			M: kit.up(bs("bbTR")),
			k: kit.low(bs("bbBL")),
			l: kit.low(bs("bbBM")),
			j: kit.low(bs("bbBR")),
			"2": kit.low(bs("plateOekaki")),
			f: kit.up(bs("painting")),
			E: kit.on(bs("easel")),
			p: kit.on(ri("tableBeige"), bs("palette")),
			// 放送部：ON AIR（夜 20〜2時と 土日は 点く。部屋に 入る ときの 時刻）・札・日誌・ガラス・台（ミキサー｜マイク｜ラジカセ）
			O: kit.up(bs(nutoOnAir(nowHour(), today().w) ? "lampOn" : "lampOff")),
			"3": kit.low(bs("plateHoso")),
			J: kit.low(PAPER),
			g: kit.on(base(3, 48), bs("glass")),
			"{": ctr(kit.on(base(3, 48), riCell("counterDark", 0, 0), bs("mixer"))),
			"|": ctr(kit.on(base(3, 48), riCell("counterDark", 1, 0), bs("mic"))),
			"}": ctr(kit.on(base(3, 48), riCell("counterDark", 2, 0), bs("boombox"))),
			// ボカロ部：一覧の 額（2マス）・札・スピーカー・キーボード・机（パソコン｜楽譜）
			R: kit.up(bsCell("roster", 0)),
			r: kit.up(bsCell("roster", 1)),
			"4": kit.low(bs("plateVoca")),
			S: kit.on(ri("flWhite"), bs("speaker")),
			Y: kit.on(ri("flWhite"), bs("synth")),
			"<": kit.on(ri("flWhite"), riCell("deskDark", 0, 0)),
			"^": kit.on(ri("flWhite"), riCell("deskDark", 1, 0), ri("pcTop")),
			">": kit.on(ri("flWhite"), riCell("deskDark", 2, 0), ri("paperNote")),
			// ゲーム制作部：エター札・札・パソコンと 机（2×2）・筐体（16x32）
			e: kit.up(bs("eta")),
			"5": kit.low(bs("plateGame")),
			"6": kit.on(ri("flDarkWood"), bs("pcTL")),
			"7": kit.on(ri("flDarkWood"), bs("pcTR")),
			"8": kit.on(ri("flDarkWood"), bs("pcBL")),
			"9": kit.on(ri("flDarkWood"), bs("pcBR")),
			A: kit.on(ri("flDarkWood"), bs("cabinet")),
			// 廊下：校歌の 額（16x32）・時計・部員募集・譜面台・下駄箱（2マス）・手洗い場・消火器（部活一覧は 既定の m）
			Q: kit.low(bs("kouka")),
			T: kit.up(CLOCK),
			b: kit.low(ri("notice")),
			s: kit.on(bs("fumendai")),
			Z: kit.on(bs("getaL")),
			z: kit.on(bs("getaR")),
			w: kit.on(bs("sink")),
			x: kit.on(ri("extinguisher")),
		}),
		things: {
			a: "aikotoba",
			"1": "plate_jinro",
			"[": "table",
			"=": "table",
			"]": "table",
			k: "kokuban",
			l: "kokuban",
			j: "kokuban",
			"2": "plate_oekaki",
			f: "painting",
			E: "easel",
			p: "palette",
			O: "onair",
			"3": "plate_hoso",
			J: "nisshi",
			"{": "mixer",
			"}": "radio",
			R: "roster",
			r: "roster",
			"4": "plate_voca",
			S: "speaker",
			Y: "synth",
			"^": "pc",
			">": "gakufu",
			e: "eta",
			"5": "plate_game",
			"6": "gamepc",
			"7": "gamepc",
			"8": "gamepc",
			"9": "gamepc",
			A: "cabinet",
			Q: "kouka",
			m: "bukatsu",
			b: "boshu",
			s: "fumendai",
			Z: "getabako",
			z: "getabako",
			w: "sink",
			x: "fire",
		},
		lines: BS_THING_LINES,
		// 遊べる 物（ui/bushitsu.ts の bushitsuThing が 物の id で 分ける）
		plays: {
			table: "bushitsu",
			easel: "bushitsu",
			onair: "bushitsu",
			radio: "bushitsu",
			nisshi: "bushitsu",
			roster: "bushitsu",
			pc: "bushitsu",
			cabinet: "bushitsu",
			fumendai: "bushitsu",
			boshu: "bushitsu",
		},
		people: [
			staff("jinro", [2, 3], "down"),
			staff("oekaki", [9, 4], "left"),
			staff("hoso", [15, 3], "down"),
			staff("voca", [21, 4], "down"),
			staff("game", [28, 4], "left"),
			staff("gassho", [6, 7], "down"),
			staff("kitaku", [17, 9], "left"),
		],
	},
	outdoor: [
		{ id: "poster", at: [43, 2], lines: BS_OUTDOOR.poster },
		{ id: "kosatsu", at: [45, 2], lines: BS_OUTDOOR.kosatsu },
		{ id: "mado", at: [47, 2], lines: BS_OUTDOOR.mado },
		{ id: "rakugaki", at: [50, 2], lines: BS_OUTDOOR.rakugaki },
	],
};

/** 部室棟（FACILITIES の 町の 役所・ホシュクラの うしろ）。 */
export const BUSHITSU_FACILITIES: readonly Facility[] = [BUSHITSU];

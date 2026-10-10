// ダンジョンの画面：入力 → run.act → 出来事の演出 → 描画 をまわす。
//
// - core の状態は1回の act で一気に変わる。画面は出来事（GameEvent）を順に再生して、
//   キャラの表示位置（Disp）を動かしていく。再生が終わったら状態に合わせなおす。
// - 押しっぱなしで歩き続ける（トルネコと同じ）。キーボードは斜めの同時押しを少し待つ。
// - ダッシュ・タップ移動は、何かあったら止まる（敵が見えた・道具・階段・分かれ道・部屋の出入り）。
// - ログは 1行ずつ 間を空けて 出す。知らせ（音・回復・レベル・安価・床に 置かれた 道具）と ステータスは、
//   それを 伝える 行より 先に 見せない（行と いっしょか、前の 行が 出てから）。動きと 戦いは 行を 待たない。
// - ボス（目的が boss の いちばん底）：見つけたら 始まりの 音 → ボスの 曲と、上に 名前と HP の ゲージ。
//   たおしたら 勝ちの 音、帰り方の 演出（rescue）→ 暗転して 冒険の記録。どれも その 行と いっしょに 出す。

import { ANKA_DUE, ankaText } from "../core/anka";
import { HUNGER_UNIT, RES_LIMIT, RES_WARN } from "../core/balance";
import { MONSTERS } from "../core/data/monsters";
import { canTarget } from "../core/effects";
import {
	DIRS8,
	type Dir8,
	dirOf,
	dist,
	isDiagonal,
	type Pos,
	step,
} from "../core/geom";
import { defOf, itemHidden } from "../core/item";
import { isFloor, roomAt, T_CORR } from "../core/mapgen";
import {
	mdef,
	monsterName,
	monsterSprite,
	posing,
	restLook,
} from "../core/monster";
import { digest, parseReplay, type ReplayStep } from "../core/replay";
import { Run } from "../core/run";
import {
	type Anka,
	type Command,
	type Floor,
	type GameEvent,
	PLAYER_ID,
	type RescueKind,
	type RunState,
	type Trap,
} from "../core/types";
import { heroWalk, KIRIKO_WALK } from "../data/cast";
import { BOSS_BGM, HOUSE_BGM, RETURN_BGM } from "../data/music";
import { goalText } from "../data/objectives";
import { diveResAt, diveResLine, goalWhy } from "../data/synopsis";
import { loadImage } from "../engine/assets";
import {
	DEBUG_SEED,
	loadBook,
	loadProgress,
	markSeenMonster,
	type SavedReplay,
	saveRun,
} from "../engine/save";
import type { Screen } from "../engine/screen";
import { settings } from "../engine/settings";
import { TILE } from "../engine/types";
import type { Ctx } from "./ctx";
import { el, nextFrame } from "./dom";
import {
	backVerb,
	floorLong,
	floorShort,
	goVerb,
	isUpBoard,
} from "./floorName";
import { glossFor } from "./glossary";
import { hpInk } from "./hpInk";
import type { Hud } from "./hud";
import { FLOWER_ICON, itemIcon } from "./icons";
import { esc } from "./itemText";
import { listWindow } from "./list";
import {
	type MenuAction,
	openFootMenu,
	openInventory,
	openMainMenu,
	pickItem,
} from "./menu";
import { bossHomeLine, showRunEnd } from "./records";
import {
	drawMap,
	type Figure,
	FloorView,
	GRAVE,
	mapTileAt,
	type Projectile,
} from "./render";
import { openSettings } from "./settings";
import { zoneFor } from "./theme";

/** 安価の のこりが これ 以下で 赤く。 */
const ANKA_WARN = 30;
/** 武器を振る長さ（振りかぶる → ななめ → 前 の3つの形）。 */
const SWING_MS = 180;
/** 長押しの足踏みの間（ms。1秒に 10回ほど）。 */
const REST_GAP_MS = 100;
/** 敵が ふえるとき、もとの マスから 分かれ出る 時間（ms）。 */
const SPLIT_MS = 260;
/** 敵の 特技（なぐる 代わりに 出す もの）の 画面の 色と、敵の 上に 出す ひとこと。 */
const SKILL_LOOK: Record<string, [string, string]> = {
	poison: ["rgba(150,90,200,0.35)", "冷笑"],
	drainLv: ["rgba(90,110,255,0.4)", "ERROR"],
	drainMax: ["rgba(120,255,140,0.3)", "縺ｧ縺ｯ"],
	warpPlayer: ["rgba(200,240,255,0.35)", "ﾋｭｰ"],
	knockback: ["rgba(255,200,90,0.35)", "ドン"],
	purge: ["rgba(255,60,60,0.4)", "削除"],
	curse: ["rgba(110,40,140,0.45)", "粘着"],
};
/**
 * ログの1行ごとの 最短の間（ms）。1ターンに いくつも起きたとき、行が 一度に 流れて 読めないように
 * （トルネコ1の メッセージ窓のように 1行ずつ 送る。そのあいだ 出来事の再生も 待つ）。
 */
const LOG_GAP_MS = { normal: 350, fast: 180, replay: 40 } as const;
/**
 * 演出の 途中で 次の 入力が 来たら（先行入力）、残りの 間を これだけに つめる。
 * 入力から 動くまでが 遅く 感じないように（シレン・トルネコも 押せば 敵の 番を 早く 流す）。
 */
const HURRY = 0.3;
/** 先行入力が あるときの ログの 間（読めないほど 速くは しない）。 */
const HURRY_LOG_GAP_MS = 120;
/** 祭り（モンスターハウス）に 入ったとき 止めて 見せる 間（ms）。 */
const HOUSE_PAUSE_MS = 900;

type Disp = Figure & {
	/** 行き先（マス）。 */
	tx: number;
	ty: number;
	/**
	 * 動きの道のり：通るマスと、そこに着く時刻。この間を線でつなぐ。
	 * 倍速の2歩は2つの点になる（角をすり抜けて見えないように）。
	 * 押しっぱなしで歩くときは、次の1歩を後ろに足す（止まって見える絵をはさまない）。
	 */
	keys: { x: number; y: number; t: number }[];
	lungeT0: number;
	/** 壁に つっかえた 時刻（向いた 方へ 少しだけ 出て もどる。行き止まりと わかるように）。 */
	bumpT0?: number;
	/** 最後に 壁に 向かった 時刻（長押しで 続けて ぶつかる あいだは 出なおさない）。 */
	bumpLast?: number;
	fadeT0: number;
	dying: boolean;
};

/**
 * ログの 待ち行列の 1つ。with は その 行を 出した ときに いっしょに 走らせる（行に つく 音・回復・レベル）。
 * text の ない ものは 行を 出さずに、前の 行が ぜんぶ 出てから with だけ 走らせる（間は 空けない）。
 */
type LogEntry = {
	text?: string;
	tone?: "warn" | "good";
	fast: boolean;
	with?: (() => void)[];
};

/** ステータス行に 出す 値。 */
type HudView = {
	depth: number;
	returning: boolean;
	lv: number;
	hp: number;
	maxHp: number;
	hunger: number;
	badges: string;
	res: number;
	anka: Anka | null;
	ankaLine: string;
	ankaLeft: number;
	/** 見つけた ボスの 名前と HP（上の ゲージ。見つける 前・たおした あとは null）。 */
	boss: { name: string; hp: number; maxHp: number } | null;
};

/**
 * 動きの 出来事。画面の 動きと いっしょに すぐ 出す（ログを 待たない。戦いの 手ざわりを 変えないように）。
 * これに 続く 音・前に ある 音は、その 動きの 音。
 */
const MOTION = new Set<GameEvent["t"]>([
	"move",
	"turn",
	"attack",
	"hurt",
	"miss",
	"die",
	"appear",
	"bolt",
	"warp",
	"fx",
	"floor",
	"house",
	"sleep",
	"doze",
	"quake",
]);

/**
 * 行の 前に 来る 知らせ（core は 音・回復・レベル・目的の品・安価・ボスを 見つけた・帰り方を、
 * それを 伝える 行の 直前に 出す）。
 */
const LEAD = new Set<GameEvent["t"]>([
	"se",
	"heal",
	"levelup",
	"baton",
	"goal",
	"anka",
	"boss",
	"rescue",
	"look",
]);

/** ev[i] の となり（step = -1 前・1 後ろ）の 出来事。敵の 様子（stir）は とばす。 */
const besideOf = (
	ev: GameEvent[],
	i: number,
	step: -1 | 1,
): GameEvent | undefined => {
	let j = i + step;
	while (ev[j]?.t === "stir") j += step;
	return ev[j];
};

/** ev[i] から 続く 知らせ（LEAD）の 先が 行なら true。 */
const leadsToLine = (ev: GameEvent[], i: number): boolean => {
	for (let j = i; j < ev.length; j++) {
		const t = ev[j].t;
		if (t === "msg") return true;
		if (!LEAD.has(t) && t !== "stir") return false;
	}
	return false;
};

/** ev[i] より 前で いちばん 近い、行・音 では ない 出来事（無ければ undefined）。 */
const deedBefore = (ev: GameEvent[], i: number): GameEvent["t"] | undefined => {
	for (let j = i - 1; j >= 0; j--) {
		const t = ev[j].t;
		if (t !== "msg" && t !== "se" && t !== "stir") return t;
	}
	return undefined;
};

/** ev[i] より 前で いちばん 近い、行・音 では ない 出来事が 動きか。 */
const afterMotion = (ev: GameEvent[], i: number): boolean => {
	const t = deedBefore(ev, i);
	return !!t && MOTION.has(t);
};

/**
 * 階ごとの BGM（層ごとに変わる。帰り道は原盤を持ち帰る曲）。
 * bossShown：ボスを 見つけた 知らせを もう 見せた（その あいだ 生きていれば ボスの 曲）。
 */
const floorBgm = (run: Run, bossShown = false): string => {
	if (run.f.houseAwake) return HOUSE_BGM;
	if (bossShown && run.boss) return BOSS_BGM;
	if (run.s.returning) return RETURN_BGM;
	return zoneFor(run.s.dungeon, run.s.depth).bgm;
};

/** 帰り方の 演出の 色（光・暗転）。escort は 送ってもらう ので 暗転は 黒。 */
const RESCUE_LOOK: Record<RescueKind, { flash: string; fade: string }> = {
	sprout: { flash: "rgba(150,230,120,0.5)", fade: "#e8f6d8" },
	escort: { flash: "rgba(255,220,150,0.35)", fade: "#000" },
	eruption: { flash: "rgba(255,140,60,0.6)", fade: "#ffd8b0" },
	geyser: { flash: "rgba(170,225,255,0.55)", fade: "#eef8ff" },
};

export class Play {
	private run: Run;
	private readonly ctx: Ctx;
	private readonly screen: Screen;
	private readonly hud: Hud;
	private view = new FloorView();
	private disp = new Map<number, Disp>();
	/**
	 * 敵の 直前の 見え方（姿・化けた 道具・見えない＝null）。状態からは もう 消えたが
	 * たおれる 演出（die）が まだ 来ていない 敵を、それまで 同じ 見え方で 描く
	 * （炎上スレで 焼かれる 敵が 火の玉より 先に 消えないように）。
	 */
	private lastLook = new Map<
		number,
		| { sprite: string; scale?: number; asleep: boolean }
		| { item: string }
		| null
	>();
	private projectiles: Projectile[] = [];
	private camX = 0;
	private camY = 0;
	private busy = false;
	/** キリコが 眠っていると 見せる（sleep の 出来事を 流している あいだ）。 */
	private sleepShown = false;
	/** 祭り・ボスの 曲を 始める 予約（始まりの 音が 鳴り終わるのを 待つ）。 */
	private houseBgmTimer = 0;
	/**
	 * ボスを 見つけた 知らせ（その 行）を もう 見せた（ボスの 曲に する。続きから 始めたら はじめから）。
	 * core の Floor.bossSeen は act の 中で 先に 立つので、曲は こちらで 行に そろえる。
	 */
	private bossShown = false;
	/** act の 前の 生きている ボスの uid（たおれた 出来事で 勝ちの 音。いなければ null）。 */
	private bossUid: number | null = null;
	/** 帰り方の 演出（rescue。冒険の記録の 前に 終わるのを 待つ）。 */
	private rescueFx: Promise<void> | null = null;
	/** カメラを 止める（帰り方の 演出で キリコだけ 動かす あいだ）。 */
	private camFreeze = false;
	private raf = 0;
	private stopped = false;
	private logEl: HTMLElement;
	/** 最後に ログの行を 出した時刻（performance.now()）。 */
	private lastLogAt = 0;
	/**
	 * まだ 出していない ログの行（1行ずつ 間を空けて 出す）。出すのを 待っても 歩きは 止めない
	 * （待つと 行が 出るたびに 次の 1歩が つっかかった）。
	 */
	private logQueue: LogEntry[] = [];
	/** ログが ぜんぶ 出るのを 待っている もの（logDrained）。 */
	private drainWaiters: (() => void)[] = [];
	private logTimer = 0;
	private popsEl: HTMLElement;
	/** jolt の ゆれを 止める タイマー。 */
	private joltTimer: ReturnType<typeof setTimeout> | undefined;
	private mapEl: HTMLCanvasElement;
	private mapOn = false;
	private fadeEl: HTMLElement;
	private lastStepAt = 0;
	private lastSavedTurn = -1;
	private resolveEnd: (() => void) | null = null;
	/** タップ移動の行き先。 */
	private travel: Pos | null = null;
	/** タップで 走っている（dash）あいだ。 */
	private dashing = false;
	/**
	 * 自動で歩いている・走っている途中の 1歩の あいだに タップした所（canvas の CSS 画素）。
	 * 止まったあと そこへ 行きなおす（止めるための タップが 捨てられて、もう一度 タップしなおすことに なっていた）。
	 */
	private pendingTap: { x: number; y: number } | null = null;
	/**
	 * 出来事を流しているあいだ、まだ映している前の階（落とし穴・地震で 下の階へ 移っても、
	 * 階の札が出るまでは 前の階のまま見せる）。落ちなかったときは null。
	 */
	private shownFloor: Floor | null = null;
	/**
	 * キリコが ワープする ターンで、ワープの 出来事を 流すまで 見せる 階（踏破の 印が ワープ前の 写し）。
	 * それまでは 見える範囲も キリコの 見えている 位置から 決める（飲む・踏む 演出の あいだに
	 * ワープ先の 部屋が 先に 明るく なったり 地図に 載ったり しないように）。ワープしないときは null。
	 */
	private preWarp: Floor | null = null;
	/**
	 * 食べる・飲む・読む・振る・投げる 演出の あいだ 描く、使う 前の 写し
	 * （効き目が 演出より 先に 見えないように）。地図が わかる スレ（reveal）は その 出来事まで、
	 * 弾や 投げた 物が 飛ぶ ときは それが 着くまで、ほかは 使う 演出が おわるまで。使わないときは null。
	 */
	private preUse: Run | null = null;
	private preUseUntil: "reveal" | "bolt" | null = null;
	/** 踏んだ 罠は、キリコの 1歩（ワープ）が 着くまで 踏む 前の 見え方（見つかる・消える が 先に 見えないように）。 */
	private trapHold: Trap[] | null = null;
	/**
	 * キリコの 見た目（アク禁・装備）は、それを 伝える 行（look）まで act の 前の まま
	 * （削除人に なぐられる 前の 1歩で 画面が 暗く なったり 武器が 消えたり しないように）。
	 */
	/**
	 * 敵の 寝ている・置物の 見た目は、その 様子が 変わった 出来事（stir）まで act の 前の まま
	 * （群れの 1体を なぐると、なぐる 前に 仲間の Z が 消えたり しないように）。uid → 見せている 見た目。
	 */
	private monHold: Map<number, { asleep: boolean; posing: boolean }> | null =
		null;
	private lookHold: {
		blind: boolean;
		weapon: string | null;
		shield: string | null;
	} | null = null;
	/**
	 * 出来事を 流して、その ログが ぜんぶ 出るまで ステータスに 出す 値（act の 前の 値。
	 * HP は 傷ついた・回復した 出来事で、レベルは その 行で 追いつく。のこりは ログに 追いついたら 今の 値に）。
	 * 草を 飲む・安価・レベルアップ などで、それを 伝える 行より 先に 数字が 変わらないように。ふだんは null。
	 */
	private hudHold: HudView | null = null;
	/** いちばん 新しい act の 番号（前の act の「ログに 追いついた」で 新しい act の 分まで 出さないように）。 */
	private holdGen = 0;
	/**
	 * この act で 床に 置かれた 道具（uid）。置かれた 出来事（item）まで・その 前の 行が 出るまで 描かない
	 * （安価の ごほうび・敵が 落とした 道具・投げて 落ちた 道具が、行や 動きより 先に 見えないように）。
	 */
	private hiddenItems = new Set<number>();
	/** この act で 床から なくなった 道具（拾った・燃えた など）。ログに 追いつくまで 描いておく。 */
	private ghostItems: { x: number; y: number; kind: string }[] = [];
	/** 長押しの足踏みを 止めている（指を離すまで）。 */
	private restHalt = false;
	/** 押さえて歩くのを 止めている（傷ついた。指を離すか 押しなおすまで）。 */
	private walkHalt = false;
	/**
	 * この階で もう 見た敵（uid）。長押しの 足踏みを 止めるのは、はじめて 見えた敵だけ
	 * （見えていた敵が 暗い通路・入口の 外へ 出て また 見えただけでは 止めない。同時に 動く敵で 止まりつづけた）。
	 */
	private spotted = new Set<number>();
	private spottedOn: Floor | null = null;
	/** 自動で歩きだしたときの 入力の番号（そのあと 何かに さわったら 止める）。 */
	private autoSerial = -1;
	/** exec を 始めたときの 入力の番号（そのあと 何かを 押したら 演出を つめる。hurried）。 */
	private execSerial = -1;
	/** 地図で タップして選んだ 行き先（閉じる前に 一瞬 光らせる）。 */
	private mapMark: Pos | null = null;
	/** 途中で止まった 自動の歩きの 行き先（地図に 印を出し、そこを タップすれば 続きを 歩く）。 */
	private lastTravel: Pos | null = null;
	/** 向きを変えたあと、方向がはなされるのを待っている。 */
	private waitRelease = false;
	/** 食べる・飲む・読むときに キリコの頭の上に出す道具。 */
	private useFx: UseFx | null = null;
	/** 倒れた所に立てる墓（倒れたときの演出）。 */
	private grave: { x: number; y: number; t0: number } | null = null;
	/** 倒れたときの「キリコは たおれた」の画面（途中で閉じたときに消すため）。 */
	private deathEl: HTMLElement | null = null;
	/** 図鑑に載っている敵（毎フレーム保存を読まないように覚えておく）。 */
	private bookSeen = new Set(loadBook().seen);
	private statusKey = "";
	/** もう 知らせた 安価（期限の レス数。出ていなければ -1）。 */
	private ankaSeen: Anka | null = null;
	/** リプレイを見ているとき（入力の代わりに 記録のコマンドを入れる）。 */
	private rp: ReplayDriver | null = null;

	constructor(
		run: Run,
		ctx: Ctx,
		screen: Screen,
		hud: Hud,
		opts: { replay?: SavedReplay } = {},
	) {
		this.run = run;
		if (opts.replay) {
			const steps = parseReplay(opts.replay.text);
			this.rp = {
				replay: opts.replay,
				steps,
				i: 0,
				done: 0,
				total: steps.filter((x) => x.kind === "cmd").length,
				paused: false,
				speed: 1,
				nextAt: 0,
				bar: null,
				drift: false,
				skip: false,
			};
		}
		this.ctx = ctx;
		this.screen = screen;
		this.hud = hud;
		this.logEl = el("div", { class: "log" });
		this.popsEl = el("div", { class: "pops" });
		this.mapEl = el("canvas", { class: "mapview" });
		this.fadeEl = el("div", { class: "fade" });
		ctx.ui.append(this.mapEl, this.popsEl, this.logEl, this.fadeEl);
	}

	/** 冒険を始めて、終わる（倒れた・持ち帰った・中断した）まで待つ。 */
	start(): Promise<"end" | "suspend"> {
		return new Promise((resolve) => {
			let suspended = false;
			this.resolveEnd = () => resolve(suspended ? "suspend" : "end");
			this.onSuspend = () => {
				suspended = true;
			};
			// 前の冒険（やめたリプレイ）の色抜けが残っていても消す
			this.screen.canvas.classList.remove("dead");
			this.syncDisp(true);
			void loadImage(GRAVE);
			// 続きから：もう 見つけて いた ボスが 生きていれば ボスの 曲と ゲージ
			this.bossShown = !!(this.run.boss && this.run.f.bossSeen);
			this.ctx.audio.bgm(floorBgm(this.run, this.bossShown));
			if (this.rp) {
				this.ctx.input.onFieldTap = null;
				this.mountReplayBar();
			} else {
				this.ctx.input.onFieldTap = (x, y) => this.onTap(x, y);
				// 遊んだ版を覚える（リプレイを見返すとき、版が変わっていないかを見る）
				const s = this.run.s;
				const builds = s.builds ?? [];
				if (builds[builds.length - 1] !== __CORE_VERSION__)
					s.builds = [...builds, __CORE_VERSION__];
			}
			// 最初の札のあいだは操作を受けない（村で押したキーも捨てる）
			this.ctx.input.clearField();
			this.ctx.input.takeDirPress();
			this.busy = true;
			void this.floorCard(true).finally(() => {
				this.busy = false;
			});
			const frame = (t: number) => {
				if (this.stopped) return;
				this.update(t);
				this.draw(t);
				this.raf = requestAnimationFrame(frame);
			};
			this.raf = requestAnimationFrame(frame);
			document.addEventListener("visibilitychange", this.onHide);
			window.addEventListener("pagehide", this.onHide);
		});
	}

	private onSuspend: () => void = () => {};

	private onHide = (): void => {
		if (document.visibilityState === "hidden" || !document.hasFocus())
			this.save(true);
	};

	private stop(): void {
		this.stopped = true;
		clearTimeout(this.houseBgmTimer);
		this.logQueue = [];
		clearTimeout(this.logTimer);
		this.resetShown();
		this.ctx.input.fieldHoldEnabled = true;
		this.screen.canvas.classList.remove("dead");
		this.deathEl?.remove();
		this.rp?.bar?.remove();
		this.hud.root.classList.remove("replay", "on-stairs");
		const foot = this.hud.root.querySelector(".mini-foot");
		if (foot) foot.textContent = "足元";
		this.ctx.ui.classList.remove("replaying");
		cancelAnimationFrame(this.raf);
		this.ctx.input.onFieldTap = null;
		document.removeEventListener("visibilitychange", this.onHide);
		window.removeEventListener("pagehide", this.onHide);
		this.logEl.remove();
		this.popsEl.remove();
		this.mapEl.remove();
		this.fadeEl.remove();
		this.hud.status.innerHTML = "";
		this.view.dispose();
		const resolve = this.resolveEnd;
		this.resolveEnd = null;
		resolve?.();
	}

	/** 終わった冒険を もう記録した（演出の途中で タブを隠しても、二度 記録しない）。 */
	private endSaved = false;

	/** 終わった冒険を 一度だけ記録する（saveRun が記録して 中断セーブを消し、町へ 持ち帰る）。 */
	private saveEnd(): void {
		if (this.rp || this.endSaved) return;
		this.endSaved = true;
		saveRun(this.run.s);
	}

	private save(force = false): void {
		if (this.rp) return; // 見ているだけ（保存も記録もしない）
		const s = this.run.s;
		if (s.end) {
			this.saveEnd();
			return;
		}
		if (!force && s.turn - this.lastSavedTurn < 8) return;
		this.lastSavedTurn = s.turn;
		saveRun(s);
	}

	// ───────────────── 表示位置 ─────────────────

	/** 表示位置を状態に合わせる（再生のあと・階が変わったとき）。 */
	private syncDisp(reset = false): void {
		const run = this.run;
		const now = performance.now();
		const keep = new Set<number>([PLAYER_ID]);
		const put = (
			id: number,
			sprite: string,
			x: number,
			y: number,
			dir: Dir8,
		) => {
			keep.add(id);
			const d = this.disp.get(id);
			if (!d || reset) {
				this.disp.set(id, {
					id,
					sprite,
					fx: x,
					fy: y,
					tx: x,
					ty: y,
					keys: [{ x, y, t: 0 }],
					dir,
					lunge: 0,
					lungeT0: 0,
					flashUntil: 0,
					fade: 0,
					fadeT0: 0,
					dying: false,
				});
				return;
			}
			d.sprite = sprite;
			d.dir = dir;
			if (d.tx !== x || d.ty !== y) {
				d.tx = x;
				d.ty = y;
				d.keys = [{ x, y, t: now }];
				d.fx = x;
				d.fy = y;
			}
		};
		put(PLAYER_ID, heroWalk(run.s), run.p.x, run.p.y, run.p.dir);
		for (const m of run.f.monsters) {
			put(m.uid, monsterSprite(m), m.x, m.y, m.dir);
			// ボスは 大きく 描く
			const d = this.disp.get(m.uid);
			if (d) d.scale = mdef(m).scale;
		}
		for (const id of [...this.disp.keys()]) {
			const d = this.disp.get(id);
			if (!keep.has(id) && d && !d.dying) this.disp.delete(id);
		}
		for (const id of [...this.lastLook.keys()])
			if (!this.disp.has(id)) this.lastLook.delete(id);
	}

	private update(t: number): void {
		// 先に入力を見る（押しっぱなしの次の1歩を、この絵から動かしはじめる）
		if (!this.busy) {
			if (this.rp) this.replayTick(t);
			else this.control(t);
		}
		for (const d of this.disp.values()) {
			const at = posAt(d.keys, t);
			d.fx = at.x;
			d.fy = at.y;
			const lk = (t - d.lungeT0) / 150;
			d.lunge = lk >= 0 && lk < 1 ? Math.sin(lk * Math.PI) : 0;
			const bk = (t - (d.bumpT0 ?? -1e9)) / 120;
			if (bk >= 0 && bk < 1)
				d.lunge = Math.max(d.lunge, Math.sin(bk * Math.PI) * 0.4);
			if (d.dying) {
				d.fade = Math.min(1, (t - d.fadeT0) / 320);
				if (d.fade >= 1) this.disp.delete(d.id);
			}
		}
		this.noteSeen();
		this.updateCamera();
		this.updateStatus();
		if (this.mapOn) {
			// ワープの 出来事までは ワープ前の 見え方で（draw と 同じ）。使う 演出の あいだは 使う 前
			const run = this.preUse ?? this.run;
			const pd = this.disp.get(PLAYER_ID);
			const pre = !this.preUse && this.preWarp && pd ? this.preWarp : null;
			const eye = pre && pd ? { x: pd.tx, y: pd.ty } : run.p;
			const blind = this.lookHold?.blind;
			const vis = run.f.monsters.filter(
				(m) => run.monsterVisible(m, eye, blind) && !m.disguise && !posing(m),
			);
			const s: RunState =
				pre && pd
					? {
							...run.s,
							floor: pre,
							player: { ...run.s.player, ...eye },
						}
					: run.s;
			drawMap(this.mapEl, s, {
				hideItems: this.hiddenItems,
				traps: this.trapHold ?? undefined,
				visibleMonsters: vis,
				mark: this.mapMark,
				resume: this.lastTravel,
			});
		}
	}

	/** 見えた敵を図鑑に載せる（はじめて会ったときだけ保存する）。 */
	private noteSeen(): void {
		const run = this.run;
		if (run.s.seed.startsWith(DEBUG_SEED) || this.rp) return;
		for (const m of run.f.monsters) {
			if (
				this.bookSeen.has(m.kind) ||
				m.disguise ||
				posing(m) ||
				!run.monsterVisible(m)
			)
				continue;
			this.bookSeen.add(m.kind);
			markSeenMonster(m.kind);
		}
	}

	private updateCamera(): void {
		const pd = this.disp.get(PLAYER_ID);
		if (!pd || this.camFreeze) return;
		const sc = this.screen;
		const cssPerSrc = sc.tileCss / TILE;
		// 上のステータス行と下のボタンの間の、まんなかにキリコを置く
		const topCss = 56;
		const bottomCss = document.documentElement.classList.contains(
			"short-landscape",
		)
			? 40
			: 260;
		const hCss = sc.height * cssPerSrc;
		const centerCss = topCss + Math.max(40, hCss - topCss - bottomCss) / 2;
		const cx = pd.fx * TILE + TILE / 2 - sc.width / 2;
		const cy = pd.fy * TILE + TILE / 2 - centerCss / cssPerSrc;
		this.camX = sc.snap(cx);
		this.camY = sc.snap(cy);
	}

	private draw(t: number): void {
		const run = this.preUse ?? this.run;
		// 落ちている途中は、階の札まで 前の階を キリコの見えている位置から映す（敵は もう いない）
		const shown = this.shownFloor;
		const pd = this.disp.get(PLAYER_ID);
		const warping =
			!shown && !this.preUse && this.preWarp && pd ? this.preWarp : null;
		const s0: RunState =
			shown && pd
				? {
						...run.s,
						floor: shown,
						depth: shown.depth,
						player: { ...run.s.player, x: pd.tx, y: pd.ty },
					}
				: warping && pd
					? {
							...run.s,
							floor: warping,
							player: { ...run.s.player, x: pd.tx, y: pd.ty },
						}
					: run.s;
		const live = s0 === run.s;
		const hold = this.lookHold;
		const blind = hold?.blind;
		const s: RunState =
			hold && blind !== s0.player.status.blind > 0
				? {
						...s0,
						player: {
							...s0.player,
							status: { ...s0.player.status, blind: blind ? 1 : 0 },
						},
					}
				: s0;
		const figs: Figure[] = [];
		const fakeItems: { x: number; y: number; kind: string }[] = [];
		// まどわされているときは 敵が みんな キリコの姿に、床の道具が お花に 見える
		const dazed = run.p.status.daze > 0;
		for (const d of this.disp.values()) {
			if (d.id === PLAYER_ID) {
				// 装備している武器・盾を重ねて描く。攻撃の踏みこみに合わせて振る
				const k = (t - d.lungeT0) / SWING_MS;
				figs.push({
					...d,
					// 演出の あいだは 眠った 出来事で（罠・呪文の 前の 1歩で Z が 出ないように）
					asleep: this.sleepShown || (!this.busy && run.p.status.sleep > 0),
					equip: hold
						? { weapon: hold.weapon, shield: hold.shield }
						: {
								weapon: run.weapon()?.kind ?? null,
								shield: run.shield()?.kind ?? null,
							},
					swing: k >= 0 && k < 1 ? k : -1,
				});
				continue;
			}
			if (d.dying) {
				figs.push(d);
				continue;
			}
			if (!live && !warping) continue;
			const m = run.f.monsters.find((x) => x.uid === d.id);
			if (!m) {
				// もう たおれたが たおれる 演出の 前：直前の 見え方の まま 描く
				const look = this.lastLook.get(d.id);
				if (!look) continue;
				if ("item" in look)
					fakeItems.push({ x: d.tx, y: d.ty, kind: look.item });
				else figs.push({ ...d, ...look });
				continue;
			}
			// ワープの 前は、ワープ前の 位置から 見える 敵だけ
			const eye = warping ? s.player : run.p;
			if (m.disguise) {
				const seen = run.playerSees(m, eye, blind);
				this.lastLook.set(d.id, seen ? { item: m.disguise } : null);
				if (seen) fakeItems.push({ x: m.x, y: m.y, kind: m.disguise });
				continue;
			}
			if (!run.monsterVisible(m, eye, blind)) {
				this.lastLook.set(d.id, null);
				continue;
			}
			const was = this.monHold?.get(m.uid);
			const look = {
				// 動きだす 前の 置物は、ただの 置物と 同じ 絵（歩かず 前向き）
				sprite: dazed
					? KIRIKO_WALK
					: (was?.posing ?? posing(m))
						? (mdef(m).still ?? d.sprite)
						: d.sprite,
				// まどわされていると みんな 同じ 大きさの キリコに 見える
				scale: dazed ? undefined : d.scale,
				asleep: was?.asleep ?? (m.status.sleep > 0 || m.status.paralyze > 0),
			};
			this.lastLook.set(d.id, look);
			figs.push({ ...d, ...look });
		}
		// なくなった 道具は ログに 追いつくまで 残して 描く（拾った 行より 先に 消えないように）
		if (live)
			for (const g of this.ghostItems)
				if (!itemHidden(s, g.kind) && run.playerSees(g, run.p, blind))
					fakeItems.push(g);
		this.view.draw(
			this.screen,
			s,
			run.dungeon.floors,
			figs,
			this.projectiles,
			this.camX,
			this.camY,
			t,
			dazed ? () => FLOWER_ICON : itemIcon,
			fakeItems,
			{
				hideItems: this.hiddenItems,
				traps: this.trapHold ?? undefined,
				strong: this.ctx.input.mods().turn,
				travel: this.travel,
				aim: this.ctx.input.mods().turn ? this.aimLine() : null,
				edge: this.edgeThreats(),
				overhead: this.useFx && overheadPose(this.useFx, t),
				grave: this.grave && {
					x: this.grave.x,
					y: this.grave.y,
					drop: (t - this.grave.t0) / GRAVE_DROP_MS,
				},
			},
		);
	}

	// ───────────────── ステータス行 ─────────────────

	private updateStatus(): void {
		const run = this.run;
		// 矢を装備していれば A の横に「矢」ボタン（のこりの本数つき）
		const arrows = run.arrows();
		const hasArrow = !!arrows && !this.rp;
		if (this.hud.root.classList.contains("has-arrow") !== hasArrow)
			this.hud.root.classList.toggle("has-arrow", hasArrow);
		const count = this.hud.root.querySelector(".btn-shoot small");
		const n = arrows ? String(arrows.count) : "";
		if (count && count.textContent !== n) count.textContent = n;
		// 使える階段の上では、足元ボタンを「階段」にして光らせる（聞かれたのを閉じても 降りられるように）
		const onStairs = this.onUsableStairs() && !this.rp;
		if (this.hud.root.classList.contains("on-stairs") !== onStairs) {
			this.hud.root.classList.toggle("on-stairs", onStairs);
			const foot = this.hud.root.querySelector(".mini-foot");
			// 文字だけ かえる（PC の すみの キーは 残す）
			const label = foot?.firstChild;
			if (label) label.textContent = onStairs ? "階段" : "足元";
		}
		// act の あとでも、その ログが 出るまでは 前の 値（hudHold）
		const v = this.hudHold ?? this.liveHud();
		const hp = Math.min(v.hp, v.maxHp);
		const { hunger, res, anka, ankaLine, ankaLeft, badges } = v;
		// 来たばかりの 安価は、スレの レスとして 画面に 出す（ログ 1行だと 気づきにくい）
		// 階を かわって 持ちこした 安価は 同じ 物なので、もう 一度は 出さない
		if (anka !== this.ankaSeen) {
			this.ankaSeen = anka;
			if (anka)
				void this.ankaPost(ankaText(anka), Math.max(1, anka.due - ANKA_DUE));
		}
		const boss = v.boss;
		const key = `${v.depth}|${v.lv}|${hp}|${v.maxHp}|${hunger}|${res}|${ankaLine}|${badges}|${v.returning}|${boss ? `${boss.name}:${boss.hp}/${boss.maxHp}` : ""}`;
		if (key === this.statusKey) return;
		this.statusKey = key;
		// HP が 半分を 切ったら、ログの 字・HP の 数字・バーを 黄色 → 赤へ（減るほど 赤く）
		const ink = hpInk(hp, v.maxHp);
		if (ink) this.logEl.style.setProperty("--ink", ink);
		else this.logEl.style.removeProperty("--ink");
		this.hud.status.style.cssText = ink ? `--ink:${ink}` : "";
		// 帰り道の 向き（下りの 板は ↑、上りの 板は ↓）
		const back = isUpBoard(run.s.dungeon) ? "↓" : "↑";
		const depthLabel = `${v.returning ? back : ""}${floorShort(run.s.dungeon, v.depth)}`;
		this.hud.status.innerHTML =
			`<div class="st-row"><span class="st-depth">${depthLabel}</span><span>Lv${v.lv}</span>` +
			`<span class="st-hp${ink ? " inked" : ""}">HP ${hp}/${v.maxHp}</span></div>` +
			`<div class="st-bar${ink ? " inked" : ""}"><i style="width:${Math.round((hp / v.maxHp) * 100)}%"></i></div>` +
			`<div class="st-row"><span class="st-hunger${hunger <= 10 ? " low" : ""}">満腹 ${hunger}%</span>` +
			`<span class="st-res${res >= RES_WARN[0] ? " low" : ""}">${res}レス</span>` +
			(v.returning ? `<span class="st-return">帰り道</span>` : "") +
			(badges ? `<span class="st-hp low">${badges}</span>` : "") +
			"</div>" +
			// 見つけた ボス：名前と HP の ゲージ（数字は 出さない）
			(boss
				? `<div class="st-row st-boss"><span class="st-boss-name">${esc(boss.name)}</span>` +
					`<span class="st-boss-bar"><i style="width:${Math.max(0, Math.min(100, Math.round((boss.hp / boss.maxHp) * 100)))}%"></i></span></div>`
				: "") +
			(ankaLine
				? `<div class="st-row st-anka${ankaLeft <= ANKA_WARN ? " low" : ""}">${ankaLine}</div>`
				: "");
	}

	/** 今の 状態の ステータスの 値（落ちている 途中は 前の 階の レス・安価）。 */
	private liveHud(): HudView {
		const run = this.run;
		const p = run.p;
		const st = p.status;
		const f = this.shownFloor ?? run.f;
		// この階（スレ）の レス数。950 を こえたら 赤く
		const res = Math.min(RES_LIMIT, f.res);
		// 出ている 安価（お題と のこりの レス）
		const anka = f.anka ?? null;
		const ankaLeft = anka ? Math.max(0, anka.due - res) : 0;
		// 見つけた ボス（見つけた 知らせを 見せてから。落ちている 途中の 前の 階には いない）
		const b = this.shownFloor ? null : run.boss;
		return {
			boss:
				b && run.f.bossSeen && this.bossShown
					? { name: monsterName(run, b), hp: b.hp, maxHp: b.maxHp }
					: null,
			depth: this.shownFloor?.depth ?? run.s.depth,
			returning: run.s.returning,
			lv: p.lv,
			hp: p.hp,
			maxHp: p.maxHp,
			hunger: Math.ceil(p.hunger / HUNGER_UNIT),
			badges: [
				st.sleep > 0 ? "眠り" : "",
				st.confuse > 0 ? "混乱" : "",
				st.blind > 0 ? "アク禁" : "",
				st.daze > 0 ? "まどわし" : "",
				st.fast > 0 ? "倍速" : "",
				st.trapped > 0 ? "はさまれ" : "",
				st.heldBy !== null ? "つかまれ" : "",
			]
				.filter(Boolean)
				.join(" "),
			res,
			anka,
			// お題と のこりを 別の かたまりに（せまい 画面では のこりが 次の 行へ 回る。切れて 見えなく ならないように）
			ankaLine: anka
				? `<span>安価：${ankaText(anka)}</span><span>（あと${ankaLeft}レス）</span>`
				: "",
			ankaLeft,
		};
	}

	/** 出来事と ログを 待たずに、今の 状態を そのまま 見せる（やめた・とばした）。 */
	private resetShown(): void {
		this.hudHold = null;
		this.lookHold = null;
		this.hiddenItems.clear();
		this.ghostItems = [];
		const ws = this.drainWaiters;
		this.drainWaiters = [];
		for (const w of ws) w();
	}

	// ───────────────── ログ ─────────────────

	/**
	 * たまった ログを 間を空けて 1行ずつ 出す（たまりすぎたら 間を つめる）。
	 * 行に ついた もの（with）は その 行と いっしょに、行の ない ものは 前の 行が 出たら すぐ 走らせる。
	 */
	private pumpLog(): void {
		clearTimeout(this.logTimer);
		while (this.logQueue.length) {
			const q = this.logQueue[0];
			if (q.text !== undefined) {
				const lines = this.logQueue.filter((x) => x.text !== undefined).length;
				const base =
					q.fast || lines > 3
						? LOG_GAP_MS.replay
						: settings.speed === "fast"
							? LOG_GAP_MS.fast
							: LOG_GAP_MS.normal;
				const gap = this.hurried() ? Math.min(base, HURRY_LOG_GAP_MS) : base;
				const since = performance.now() - this.lastLogAt;
				if (since < gap) {
					this.logTimer = window.setTimeout(() => this.pumpLog(), gap - since);
					return;
				}
			}
			this.logQueue.shift();
			if (q.text !== undefined) {
				this.addLog(q.text, q.tone);
				// はじめて 出た 2ch の ことばには 1度だけ 説明の 1行（リプレイでは 出さない・覚えない）
				const gloss = this.rp ? null : glossFor(q.text);
				if (gloss) this.addLog(gloss, "gloss");
				this.lastLogAt = performance.now();
			}
			for (const fn of q.with ?? []) fn();
		}
		const ws = this.drainWaiters;
		this.drainWaiters = [];
		for (const w of ws) w();
	}

	/** まだ 出していない ログが ぜんぶ 出たら fn（無ければ すぐ）。待たない。 */
	private afterLog(fn: () => void): void {
		if (!this.logQueue.length) fn();
		else this.logQueue.push({ fast: false, with: [fn] });
	}

	/** 演出の 途中で 次の 入力が 来た（exec を 始めてから 何かを 押した）。リプレイでは 使わない。 */
	private hurried(): boolean {
		return this.busy && !this.rp && this.ctx.input.serial !== this.execSerial;
	}

	/**
	 * 演出の 間（ms）。途中で 次の 入力が 来たら 残りを HURRY 倍に つめる（待っている 途中でも 効く）。
	 * ログの 待ちも 縮むよう、つめはじめたら ログを 送りなおす。
	 */
	private async beat(ms: number): Promise<void> {
		const t0 = performance.now();
		let pumped = false;
		for (;;) {
			const h = this.hurried();
			if (h && !pumped) {
				pumped = true;
				this.pumpLog();
			}
			const left = ms * (h ? HURRY : 1) - (performance.now() - t0);
			if (left <= 0 || this.stopped) return;
			await wait(Math.min(left, FRAME_MS));
		}
	}

	/** まだ 出していない ログが ぜんぶ 出るまで 待つ（出来事の 再生を 行に 追いつかせる）。 */
	private logDrained(): Promise<void> {
		if (!this.logQueue.length || this.stopped) return Promise.resolve();
		return new Promise((ok) => this.drainWaiters.push(ok));
	}

	private addLog(text: string, tone?: "warn" | "good" | "gloss"): void {
		const line = el("div", {
			class: `log-line${tone ? ` ${tone}` : ""}`,
			text,
		});
		this.logEl.appendChild(line);
		// 残す行数：縦に 余裕のある画面（スマホの縦持ち など）は 4行、ほかは 3行
		const keep = window.innerHeight >= 640 ? 4 : 3;
		const lines = [...this.logEl.children];
		for (const l of lines.slice(0, Math.max(0, lines.length - keep)))
			l.remove();
		for (const l of [...this.logEl.children].slice(0, -1))
			l.classList.add("old");
		setTimeout(() => line.classList.add("gone"), 4200);
		setTimeout(() => line.remove(), 5000);
	}

	/** 画面を 1回 小さく ゆらす（style.css の body.jolt）。続けて 呼んでも 頭から ゆらしなおす。 */
	private jolt(): void {
		const b = document.body;
		b.classList.remove("jolt");
		void b.offsetWidth;
		b.classList.add("jolt");
		clearTimeout(this.joltTimer);
		this.joltTimer = setTimeout(() => b.classList.remove("jolt"), 200);
	}

	private pop(pos: Pos, text: string, cls: string): void {
		const sc = this.screen;
		const cssPerSrc = sc.tileCss / TILE;
		const x = (pos.x * TILE + TILE / 2 - this.camX) * cssPerSrc;
		const y = (pos.y * TILE - this.camY) * cssPerSrc;
		const p = el("div", { class: `pop ${cls}`, text });
		p.style.left = `${x}px`;
		p.style.top = `${y}px`;
		this.popsEl.appendChild(p);
		setTimeout(() => p.remove(), cls === "lvup" ? 1500 : 850);
	}

	// ───────────────── 入力 ─────────────────

	private control(t: number): void {
		const input = this.ctx.input;
		if (input.busy) {
			// 窓が 開いたら（階段の 問いなど）、歩いている途中の タップは 忘れる
			this.pendingTap = null;
			return;
		}
		if (!input.restHeld()) this.restHalt = false;
		// 自動で歩いている（タップ・地図のタップ）あいだに 何かに さわったら 止める。
		// さわった入力は 捨てる（止めるつもりの 十字キーで 1歩・A で 空振り、に ならないように）
		if (this.travel && input.serial !== this.autoSerial) {
			this.lastTravel = this.travel;
			this.travel = null;
			this.swallowInput();
			return;
		}
		// 自動で歩いている 途中に タップした所へ 行きなおす。キリコの上なら 止まるだけ（足元の窓は 開かない）
		const tap = this.pendingTap;
		if (tap) {
			this.pendingTap = null;
			const k = this.screen.tileCss / TILE;
			const cx = (tap.x - this.camX) * k;
			const cy = (tap.y - this.camY) * k;
			if (this.dirFromScreen(cx, cy) !== null) {
				this.onTap(cx, cy);
				return;
			}
		}
		const key = input.takeField();
		if (key) {
			this.travel = null;
			void this.onKey(key);
			return;
		}
		const held = input.heldDir();
		// 押さえて歩いている途中で 新しい敵が見えた・傷ついたら、指を離すまで 止まる（押しなおせば 歩ける）
		if (this.walkHalt) {
			if (input.pendingDirPress) this.walkHalt = false;
			else if (held === null && !input.fieldHold()) this.walkHalt = false;
			else return;
		}
		// 向きを変えたあとは、方向を一度はなすまで歩かない
		// （向きボタンをはなした瞬間に、押したままの方へ歩きださないように）
		if (this.waitRelease) {
			if (held === null && !input.pendingDirPress) this.waitRelease = false;
			else if (!input.mods().turn) {
				input.takeDirPress();
				return;
			}
		}
		// キーボードの斜め（2つ同時押し）を少しだけ待つ
		if (input.heldFor() < 45 && (held !== null || input.pendingDirPress))
			return;
		// 押しっぱなしの歩きは 1歩の動き（playEvents の stepMs）が終わりしだい続ける。ここは連打の間隔だけ
		const gap = settings.speed === "fast" ? 50 : 80;
		if (t - this.lastStepAt < gap && (held !== null || input.pendingDirPress))
			return;
		// 押しっぱなしでなくても、短く押した向きには1歩進む
		const pressed = input.takeDirPress();
		const dir = held ?? pressed;
		if (dir !== null) {
			this.travel = null;
			const mods = input.mods();
			if (mods.turn) {
				// その場で向きだけ変える（時間は進まない）
				if (this.run.p.dir !== dir) void this.exec({ c: "turn", dir });
				input.useMod("turn");
				this.waitRelease = true;
				return;
			}
			if (mods.diag && !isDiagonal(dir)) return;
			this.lastStepAt = t;
			if (mods.dash) void this.dash(dir);
			else void this.walkStep(mods.diag ? dir : this.slideDir(dir));
			return;
		}
		// 十字キーの まん中を 長押し：足踏み（押さえているあいだ 続ける。トルネコの A＋B 押しっぱなし）
		if (input.restHeld()) {
			if (this.restHalt || t - this.lastStepAt < REST_GAP_MS) return;
			this.travel = null;
			this.lastStepAt = t;
			void this.restStep();
			return;
		}
		// 画面を押さえつづけたら、その方へ歩きつづける（どこでも十字キー）
		const hold = input.fieldHold();
		if (hold) {
			this.travel = null;
			const want = input.fieldHoldDir((x, y) => this.dirFromScreen(x, y));
			if (want === null || t - this.lastStepAt < gap) return;
			const mods = input.mods();
			if (mods.turn) {
				if (this.run.p.dir !== want) void this.exec({ c: "turn", dir: want });
				return;
			}
			if (mods.diag && !isDiagonal(want)) return;
			// 敵がいる向きは そのまま（向くだけ）。いなければ 近い歩ける向きへ
			const ahead = step(this.run.p, want);
			const m = this.run.monsterAt(ahead.x, ahead.y);
			const dir =
				m && this.run.monsterVisible(m)
					? want
					: (this.passableNear(want, 1) ?? want);
			this.lastStepAt = t;
			void this.walkStep(dir);
			return;
		}
		if (this.travel) void this.travelStep();
	}

	/**
	 * となりの敵に なぐられたら そちらを向く（シレンと 同じ。A で すぐ なぐり返せるように）。
	 * 規則（core）は かえず、ふつうの「向く」コマンドとして 出す（時間は 進まない。リプレイにも 残るので
	 * 前の リプレイも そのまま 再生できる）。何匹かに なぐられたら 最後の 敵。
	 */
	private async faceAttacker(ev: readonly GameEvent[]): Promise<void> {
		const run = this.run;
		const p = run.p;
		for (let i = ev.length - 1; i >= 0; i--) {
			const e = ev[i];
			if (e.t !== "attack" || e.id === PLAYER_ID) continue;
			const m = run.f.monsters.find((x) => x.uid === e.id);
			if (
				!m ||
				!run.monsterVisible(m) ||
				m.disguise ||
				posing(m) ||
				dist(p, m) !== 1
			)
				continue;
			const d = dirOf(m.x - p.x, m.y - p.y);
			if (d === null || d === p.dir) return;
			await this.playEvents(run.act({ c: "turn", dir: d }), true);
			this.syncDisp();
			return;
		}
	}

	/**
	 * 斜めが 壁・角で 進めないとき、たて・よこの 片方だけ 進めるなら そちらへ（壁に そって すべる）。
	 * 進めない 斜めは もともと 何も 起きない（時間も 進まない）ので、そのかわり。どちらも・どちらも だめなら そのまま。
	 * 敵の いる 向きは かえない（向く・なぐるの じゃまを しない）。
	 */
	private slideDir(dir: Dir8): Dir8 {
		const run = this.run;
		if (!isDiagonal(dir) || run.p.status.confuse > 0) return dir;
		const ahead = step(run.p, dir);
		const m = run.monsterAt(ahead.x, ahead.y);
		if (run.canStepTerrain(run.p, dir) || (m && run.monsterVisible(m)))
			return dir;
		const open = [((dir + 7) % 8) as Dir8, ((dir + 1) % 8) as Dir8].filter(
			(c) => {
				const n = step(run.p, c);
				return run.canStepTerrain(run.p, c) && !run.monsterAt(n.x, n.y);
			},
		);
		return open.length === 1 ? open[0] : dir;
	}

	/**
	 * A で なぐる 向き。正面に 見えている敵が いれば 正面。いなくて、なぐれる となりの 敵が 1匹だけなら そちら
	 * （2匹 以上なら どれか 決められないので 正面のまま）。
	 */
	private attackDir(): Dir8 {
		const run = this.run;
		const p = run.p;
		const foe = (d: Dir8): boolean => {
			const to = step(p, d);
			const m = run.monsterAt(to.x, to.y);
			return (
				!!m &&
				run.monsterVisible(m) &&
				!m.disguise &&
				!posing(m) &&
				run.cornerOk(p, d)
			);
		};
		if (foe(p.dir)) return p.dir;
		// 眠っている 敵へは 自動で 向かない（となりを 倒したあと A を 連打して、寝ている 強い 敵を 起こさないように。
		// 起こしたいときは 向いてから なぐる）
		const near = ([0, 1, 2, 3, 4, 5, 6, 7] as Dir8[]).filter((d) => {
			if (!foe(d)) return false;
			const to = step(p, d);
			return !(run.monsterAt(to.x, to.y)?.status.sleep ?? 0);
		});
		return near.length === 1 ? near[0] : p.dir;
	}

	/** 自動で歩くのを止めた入力を 捨てる（十字キーは 一度はなすまで 歩かない）。 */
	private swallowInput(): void {
		const input = this.ctx.input;
		input.takeDirPress();
		input.clearField();
		this.waitRelease = true;
	}

	/** 自動で歩きだす（タップ・地図のタップ）。このあと 何かに さわったら 止まる。 */
	private startTravel(to: Pos): void {
		this.travel = to;
		this.lastTravel = null;
		this.autoSerial = this.ctx.input.serial;
	}

	/** 向いている先の マス（壁か 見えている敵まで。敵がいれば hit）。向きを変えるあいだの ねらいの線。 */
	private aimLine(): {
		cells: Pos[];
		hit: Pos | null;
	} {
		const run = this.run;
		const cells: Pos[] = [];
		let at: Pos = { x: run.p.x, y: run.p.y };
		for (let i = 0; i < 12; i++) {
			const nx = step(at, run.p.dir);
			if (!isFloor(run.f.layout, nx.x, nx.y)) break;
			const m = run.monsterAt(nx.x, nx.y);
			if (m && run.monsterVisible(m) && !m.disguise) return { cells, hit: nx };
			cells.push(nx);
			at = nx;
		}
		return { cells, hit: null };
	}

	/** 見えている敵と、画面の 見える所（上のステータス・下のボタンを のぞく）の 上下（ソース画素）。 */
	private edgeThreats(): {
		threats: Pos[];
		top: number;
		bottom: number;
	} | null {
		if (this.rp) return null;
		const run = this.run;
		const threats = run.f.monsters
			.filter((m) => run.monsterVisible(m) && !m.disguise && !posing(m))
			.map((m) => ({ x: m.x, y: m.y }));
		if (!threats.length) return null;
		const k = this.screen.tileCss / TILE;
		const controls = this.hud.root.classList.contains("hidden")
			? 0
			: Number.parseFloat(
					getComputedStyle(this.hud.root).getPropertyValue("--controls-h"),
				) || 0;
		return {
			threats,
			top: 56 / k,
			bottom: this.screen.height - controls / k,
		};
	}

	/**
	 * 押さえて歩く 1歩。傷ついたら、指を離すまで 止める。
	 * 敵が 見えただけでは 止めない（トルネコ1の 歩きと 同じ。止まるのは ダッシュだけ。
	 * 画面の 外の 敵は ふちの 印で わかる）。
	 */
	private async walkStep(dir: Dir8): Promise<void> {
		const run = this.run;
		const hp = run.p.hp;
		await this.exec({ c: "move", dir });
		if (run.p.hp < hp) this.walkHalt = true;
	}

	/**
	 * いま 見えている敵のうち、この階で はじめて 見えた敵が いたか（見たと 覚える）。
	 * 逃げる敵（ROM専・ナツコ）は 数えない（寄ってこないので、見えるたびに 足踏みが 止まると 休めない。
	 * 追いつめて なぐられたら 傷ついた ほうで 止まる）。
	 */
	private spotNew(): boolean {
		const run = this.run;
		if (this.spottedOn !== run.s.floor) {
			this.spottedOn = run.s.floor;
			this.spotted.clear();
		}
		let fresh = false;
		for (const m of run.f.monsters)
			if (run.monsterVisible(m) && !this.spotted.has(m.uid)) {
				this.spotted.add(m.uid);
				if (!mdef(m).abilities.some((a) => a.k === "shy")) fresh = true;
			}
		return fresh;
	}

	/**
	 * 長押しの足踏み 1回。敵が新しく見えた・傷ついた・階が変わったら、指を離すまで 止める
	 * （押さえたまま なぐられつづけないように）。
	 */
	private async restStep(): Promise<void> {
		const run = this.run;
		this.spotNew();
		const hp = run.p.hp;
		const floor = run.s.floor;
		await this.exec({ c: "wait" });
		if (run.p.hp < hp || run.s.floor !== floor || this.spotNew())
			this.restHalt = true;
	}

	private async onKey(key: string): Promise<void> {
		const run = this.run;
		switch (key) {
			case "a":
				// 正面に 敵が いなくて、となりの 起きている 敵が 1匹だけなら そちらを 向いて なぐる（向きボタンを 使わずに すむように）
				await this.exec({ c: "attack", dir: this.attackDir() });
				return;
			case "b":
				// 前作（rpg）と 同じく B は メニュー（1段目が もちもの）。ボタンを 減らすため ☰ と まとめた
				await this.menu(openMainMenu(this.ctx, run));
				return;
			case "items":
				// PC の I キー：もちものを じかに
				await this.menu(openInventory(this.ctx, run));
				return;
			case "menu":
				await this.menu(openMainMenu(this.ctx, run));
				return;
			case "wait":
				await this.exec({ c: "wait" });
				return;
			case "foot":
				// 階段の上では そのまま「降りますか？」
				if (this.onUsableStairs()) await this.askStairs();
				else await this.menu(openFootMenu(this.ctx, run));
				return;
			case "map":
				this.toggleMap();
				return;
			case "stairs":
				if (run.onStairs()) await this.exec({ c: "stairs" });
				return;
			case "sort":
				// 持ち物の 整理（PC の O キー。時間は 進まない）
				if (run.p.items.length > 1) await this.exec({ c: "sort" });
				return;
			case "voice":
				// 蓄音機の 再生（録っていなければ ひとこと だけ）
				await this.exec({ c: "play" });
				return;
			case "shoot":
				// 装備した矢を 向いている方へ 1本
				await this.exec({ c: "shoot" });
				return;
			case "throw": {
				const uid = await pickItem(
					this.ctx,
					run,
					"なにを　投げる？",
					() => true,
				);
				if (uid !== null) await this.exec({ c: "throw", item: uid });
				return;
			}
		}
	}

	private toggleMap(): void {
		this.mapOn = !this.mapOn;
		this.mapEl.classList.toggle("shown", this.mapOn);
		// 地図を開いているあいだは 画面を押さえても 歩かない（ゆっくり押しても タップになる）
		this.ctx.input.fieldHoldEnabled = !this.mapOn;
		this.ctx.se("cursor");
	}

	private async menu(p: Promise<MenuAction>): Promise<void> {
		this.busy = true;
		let a: MenuAction;
		try {
			a = await p;
		} finally {
			this.busy = false;
		}
		switch (a.kind) {
			case "command":
				await this.exec(a.cmd);
				if (a.reopen === "items" && !this.run.s.end && !this.stopped)
					await this.menu(openInventory(this.ctx, this.run));
				return;
			case "map":
				this.toggleMap();
				return;
			case "settings":
				this.busy = true;
				await openSettings(this.ctx);
				this.busy = false;
				return;
			case "suspend":
				this.save(true);
				this.ctx.se("save");
				this.onSuspend();
				this.stop();
				return;
			case "none":
				return;
		}
	}

	/**
	 * 地図を開いているときの タップ：そのマス（少しずれても 近くの 知っている床）まで 自動で歩く。
	 * 歩きだしたら 地図は閉じる（まわりを見ながら 歩けるように。敵が見えたら 止まるのは タップ移動と同じ）。
	 */
	private mapTap(cssX: number, cssY: number): void {
		const run = this.run;
		const r = this.screen.canvas.getBoundingClientRect();
		const at = mapTileAt(this.mapEl, run.s, r.left + cssX, r.top + cssY);
		const p = run.p;
		if (!at || (at.x === p.x && at.y === p.y)) {
			this.toggleMap();
			return;
		}
		// 小さい地図では 階段や道具の点に ぴったり触れないので、指の幅（約 20 CSS 画素）の中の 階段・道具に 寄せる
		const target =
			this.mapPoint(at.x, at.y, Math.max(1, Math.ceil(20 / at.cellCss))) ??
			this.nearKnownFloor(at.x, at.y, 2);
		if (!target) {
			// 地図の 帯の 中でも 行き先が なければ 閉じる（地図の 外を 押したときと 同じ）。
			// 地図は 半透明で 気づきにくく、床を 押しても 何度も 音だけ 鳴って 動けなく なっていた
			this.toggleMap();
			return;
		}
		// 選んだ所を 一瞬 光らせてから 閉じて 歩きだす
		this.ctx.se("cursor");
		this.mapMark = target;
		setTimeout(() => {
			this.mapMark = null;
			if (this.stopped) return;
			if (this.mapOn) this.toggleMap();
			this.startTravel(target);
		}, 170);
	}

	/** 地図の (x, y) のまわり radius マスで いちばん近い 階段か 見えている道具（自分のいるマスは のぞく）。 */
	private mapPoint(x: number, y: number, radius: number): Pos | null {
		const run = this.run;
		const f = run.f;
		const l = f.layout;
		const p = run.p;
		const seenItem = new Set(run.s.seen);
		const pts: Pos[] = [];
		if (this.lastTravel) pts.push(this.lastTravel);
		if (f.seen[f.stairs.y * l.w + f.stairs.x]) pts.push(f.stairs);
		for (const fi of f.items)
			if (
				!itemHidden(run.s, fi.item.kind) &&
				(f.senseItems ||
					(f.seen[fi.y * l.w + fi.x] && seenItem.has(fi.item.uid)))
			)
				pts.push(fi);
		let best: Pos | null = null;
		let bd = 99;
		for (const q of pts) {
			if (q.x === p.x && q.y === p.y) continue;
			const d = Math.max(Math.abs(q.x - x), Math.abs(q.y - y));
			if (d <= radius && d < bd) {
				bd = d;
				best = { x: q.x, y: q.y };
			}
		}
		return best;
	}

	/** 画面の点（canvas の CSS 画素）が、十字キー・A/B・小さいボタンの まわり 24 画素の中か。 */
	private nearControls(cssX: number, cssY: number): boolean {
		const r = this.screen.canvas.getBoundingClientRect();
		const cx = r.left + cssX;
		const cy = r.top + cssY;
		const pad = 24;
		for (const e of this.hud.root.querySelectorAll<HTMLElement>(
			".pad, .ab .btn, .minis .mini",
		)) {
			if (!e.offsetParent) continue; // 隠れている
			const b = e.getBoundingClientRect();
			if (
				cx >= b.left - pad &&
				cx <= b.right + pad &&
				cy >= b.top - pad &&
				cy <= b.bottom + pad
			)
				return true;
		}
		return false;
	}

	/** 見えている敵が n マス以内にいるか。 */
	private enemyWithin(n: number): boolean {
		const run = this.run;
		return run.f.monsters.some(
			(m) =>
				run.monsterVisible(m) &&
				!m.disguise &&
				!posing(m) &&
				dist(m, run.p) <= n,
		);
	}

	/** (x, y) か、そのまわり radius マスの中で いちばん近い 知っている床（自分のいるマスは のぞく）。 */
	private nearKnownFloor(x: number, y: number, radius: number): Pos | null {
		const run = this.run;
		const p = run.p;
		const l = run.f.layout;
		const known = (tx: number, ty: number) =>
			tx >= 0 &&
			ty >= 0 &&
			tx < l.w &&
			ty < l.h &&
			isFloor(l, tx, ty) &&
			!!run.f.seen[ty * l.w + tx] &&
			(tx !== p.x || ty !== p.y);
		if (known(x, y)) return { x, y };
		let best = 99;
		let target: Pos | null = null;
		for (let dy = -radius; dy <= radius; dy++)
			for (let dx = -radius; dx <= radius; dx++) {
				if (!known(x + dx, y + dy)) continue;
				const dd = Math.abs(dx) + Math.abs(dy);
				if (dd < best) {
					best = dd;
					target = { x: x + dx, y: y + dy };
				}
			}
		return target;
	}

	private onTap(cssX: number, cssY: number): void {
		if (this.busy) {
			// 自動で歩いている 途中の タップは、止まってから そこへ 行きなおす
			// （そのあいだに カメラが 動くので、地図の上の 点で 覚えておく）
			if (this.travel || this.dashing) {
				const k = this.screen.tileCss / TILE;
				this.pendingTap = { x: cssX / k + this.camX, y: cssY / k + this.camY };
			}
			return;
		}
		if (this.mapOn) {
			this.mapTap(cssX, cssY);
			return;
		}
		// 下のボタン（十字キー・A/B・小さいボタン）の すぐそばの タップは、敵が近くにいれば 歩かない
		// （A を押しそこねて 敵のそばで 歩きだす・走りだす のを ふせぐ）
		if (this.nearControls(cssX, cssY) && this.enemyWithin(3)) {
			this.ctx.se("cancel");
			return;
		}
		const sc = this.screen;
		const src = sc.cssToSource(cssX, cssY);
		const x = Math.floor((src.x + this.camX) / TILE);
		const y = Math.floor((src.y + this.camY) / TILE);
		const run = this.run;
		const p = run.p;
		if (x === p.x && y === p.y) {
			void this.menu(openFootMenu(this.ctx, run));
			return;
		}
		const d = dirOf(x - p.x, y - p.y);
		if (dist(p, { x, y }) === 1 && d !== null) {
			const m = run.monsterAt(x, y);
			// となりの敵をタップ：まず そちらを向く。向いていれば なぐる
			if (m && run.monsterVisible(m) && !m.disguise && !posing(m)) {
				// 壁の 角ごしの 斜めは なぐれない（空ぶりで 1手 むだに なる）。なぐれる マスへ 回りこむ
				if (!run.cornerOk(p, d)) {
					this.startTravel({ x, y });
					return;
				}
				void this.exec(
					p.dir === d ? { c: "attack", dir: d } : { c: "turn", dir: d },
				);
				return;
			}
		}
		// 離れた敵をタップ：まっすぐ 並んでいて そちらを 向いていなければ、まず 向く
		// （時間は進まない。矢・杖・投げるの ねらいに）。それ以外は 敵の となりまで 歩く
		// （となりに 来たら 止まる。敵の 解説は 出さない。図鑑で 見られる）
		const far = run.monsterAt(x, y);
		if (
			far &&
			run.monsterVisible(far) &&
			!far.disguise &&
			!posing(far) &&
			dist(p, far) > 1
		) {
			const dx = far.x - p.x;
			const dy = far.y - p.y;
			if (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)) {
				const fd = dirOf(Math.sign(dx), Math.sign(dy));
				if (fd !== null && fd !== p.dir) {
					void this.exec({ c: "turn", dir: fd });
					return;
				}
			}
			this.startTravel({ x: far.x, y: far.y });
			return;
		}
		// まだ見ていない所（暗い通路の先など）を 2マス以上 先にタップしたら、その方へ 何かあるまで走る
		// （近くの 知っている床＝となりのマス に寄せると 1マスずつしか 進めないので）
		const lay = run.f.layout;
		const seenTap =
			x >= 0 && y >= 0 && x < lay.w && y < lay.h && !!run.f.seen[y * lay.w + x];
		// 走りだす 向きの ずれ：通路では 曲がり角に そって 90° まで、部屋では 45° まで
		// （部屋の はしで 1段 ずれた 通路を タップすると、壁を よけて 真下へ 走って いた）
		const spread = lay.tiles[p.y * lay.w + p.x] === T_CORR ? 2 : 1;
		if (!seenTap && dist(p, { x, y }) >= 2) {
			const toward = this.dirFromScreen(cssX, cssY);
			const first = toward === null ? null : this.passableNear(toward, spread);
			if (first !== null) {
				void this.dash(first, true);
				return;
			}
		}
		// 知っている床ならそこへ。少しずれて壁をタップしたときは、となりの知っている床に寄せる
		const target = this.nearKnownFloor(x, y, 1);
		if (target) {
			const td = dirOf(target.x - p.x, target.y - p.y);
			if (dist(p, target) === 1 && td !== null) {
				// となりの 通路を タップ：敵が 見えて いなければ 通路に そって 走る
				// （通路は 1マス先しか 見えないので、1歩ずつ タップしなおす ことに なっていた。敵が 出たら 止まる）
				if (
					lay.tiles[target.y * lay.w + target.x] === T_CORR &&
					this.snapshot().monsters === 0
				) {
					void this.dash(td);
					return;
				}
				void this.exec({ c: "move", dir: td });
				return;
			}
			this.startTravel(target);
			return;
		}
		// 見ていない 所の 少し 手前に 知っている 床（部屋の はしから 1段 ずれた 通路の 入口 など）が あれば、そこまで 歩く
		if (!seenTap) {
			const near = this.nearKnownFloor(x, y, 2);
			if (near) {
				this.startTravel(near);
				return;
			}
		}
		// 見ていない所（通路の先など）をタップしたら、その方へ 何かあるまで走る（通路の角はついていく）
		const toward = this.dirFromScreen(cssX, cssY);
		const first = toward === null ? null : this.passableNear(toward, spread);
		if (first !== null) void this.dash(first, true);
	}

	/** 画面の点（canvas の CSS 画素）が、キリコから見てどの向きか。キリコの上なら null。 */
	private dirFromScreen(cssX: number, cssY: number): Dir8 | null {
		const pd = this.disp.get(PLAYER_ID);
		if (!pd) return null;
		const k = this.screen.tileCss / TILE;
		const px = (pd.fx * TILE + TILE / 2 - this.camX) * k;
		const py = (pd.fy * TILE + TILE / 2 - this.camY) * k;
		const dx = cssX - px;
		const dy = cssY - py;
		if (Math.hypot(dx, dy) < this.screen.tileCss * 0.6) return null;
		return ((Math.round(Math.atan2(dx, -dy) / (Math.PI / 4)) + 8) % 8) as Dir8;
	}

	/**
	 * d に近い向きのうち、歩ける向き（まず d、つぎに ±45°、spread が 2 なら ±90° まで）。
	 * 通路の入口を少しずれてタップ・押さえても、通路へ入れるように。どこも歩けなければ null。
	 */
	private passableNear(d: Dir8, spread: 1 | 2): Dir8 | null {
		const run = this.run;
		const order = spread === 2 ? [0, 1, -1, 2, -2] : [0, 1, -1];
		for (const o of order) {
			const c = ((((d + o) % 8) + 8) % 8) as Dir8;
			if (run.canStepTerrain(run.p, c)) return c;
		}
		return null;
	}

	// ───────────────── 実行と演出 ─────────────────

	/** コマンドを実行して、出来事を演出する。 */
	async exec(cmd: Command, fast = false): Promise<GameEvent[]> {
		if (this.busy || this.stopped) return [];
		this.busy = true;
		// ここから 後に 押したら 先行入力（演出を つめる）
		this.execSerial = this.ctx.input.serial;
		const run = this.run;
		const wasOnStairs = run.onStairs();
		const before = { x: run.p.x, y: run.p.y };
		let ev: GameEvent[] = [];
		// 使う道具（食べる・飲む・読む演出のため、使う前に見ておく）
		const using =
			cmd.c === "use"
				? (run.findItem(cmd.item) ??
					run.f.items.find((fi) => fi.item.uid === cmd.item)?.item)
				: undefined;
		const turn0 = run.s.turn;
		const floor0 = run.s.floor;
		// ワープしたら、ワープの 出来事までは この 写しで 見せる（preWarp）
		const seen0 = run.f.seen.slice();
		const traps0 = run.f.traps.map((t) => ({ ...t }));
		const mons0 = new Map(run.f.monsters.map((m) => [m.uid, restLook(m)]));
		const look0 = {
			blind: run.p.status.blind > 0,
			weapon: run.weapon()?.kind ?? null,
			shield: run.shield()?.kind ?? null,
		};
		const usingCat = using && defOf(using.kind).cat;
		const pre =
			cmd.c === "throw" ||
			cmd.c === "shoot" ||
			(usingCat &&
				(USE_STYLE[usingCat] || usingCat === "staff" || usingCat === "arrow"))
				? new Run(structuredClone(run.s))
				: null;
		// ステータスと 床の 道具は、出来事と ログが 追いつくまで act の 前の まま 見せる
		this.hudHold ??= this.liveHud();
		const gen = ++this.holdGen;
		const items0 = new Map(run.f.items.map((fi) => [fi.item.uid, fi]));
		// 足もとに 残して 描いていた 道具は もう 拾い済み。拾った 行が 出る 前に 歩きだすと
		// 元の マスに 残像が 見えるので、次の 行動の 前に 消す
		this.ghostItems = this.ghostItems.filter(
			(g) => g.x !== run.p.x || g.y !== run.p.y,
		);
		// この act で ボスが たおれたら 勝ちの 音（たおれると 階から 消えるので 先に 覚える）
		this.bossUid = run.f.boss ?? null;
		try {
			ev = run.act(cmd);
			if (run.s.floor === floor0) {
				const now = new Set(run.f.items.map((fi) => fi.item.uid));
				for (const fi of run.f.items)
					if (!items0.has(fi.item.uid)) this.hiddenItems.add(fi.item.uid);
				for (const fi of items0.values())
					if (!now.has(fi.item.uid))
						this.ghostItems.push({ x: fi.x, y: fi.y, kind: fi.item.kind });
			}
			if (run.s.floor !== floor0) this.shownFloor = floor0;
			else if (ev.some((e) => e.t === "warp" && e.id === PLAYER_ID))
				this.preWarp = { ...floor0, seen: seen0 };
			if (
				run.s.floor === floor0 &&
				ev.some(
					(e) => (e.t === "move" || e.t === "warp") && e.id === PLAYER_ID,
				) &&
				(traps0.length !== run.f.traps.length ||
					traps0.some((t, i) => t.found !== run.f.traps[i].found))
			)
				this.trapHold = traps0;
			// 前の act の 見た目を まだ 待って いれば そのまま（行が 来たら 外れる）
			if (ev.some((e) => e.t === "look")) this.lookHold ??= look0;
			if (run.s.floor === floor0) {
				// 途中で 変わった 敵（{t:"stir"}）は、その 出来事まで 前の 見た目
				const stirred = new Set(
					ev.flatMap((e) => (e.t === "stir" ? [e.id] : [])),
				);
				const held = new Map<number, { asleep: boolean; posing: boolean }>();
				for (const m of run.f.monsters) {
					const a = mons0.get(m.uid);
					const b = restLook(m);
					if (
						a &&
						(stirred.has(m.uid) ||
							a.asleep !== b.asleep ||
							a.posing !== b.posing)
					)
						held.set(m.uid, a);
				}
				if (held.size) this.monHold = held;
			}
			// 倒れた（持ち帰った）その場で中断セーブを片づける（演出の途中で閉じても やり直せないように）
			if (run.s.end) this.saveEnd();
			// 使えたら（時間が進んだら）、効き目を出す前に 食べる・飲む・読む
			if (pre && run.s.turn !== turn0) {
				this.preUseUntil = ev.some((e) => e.t === "reveal")
					? "reveal"
					: ev.some((e) => e.t === "bolt")
						? "bolt"
						: null;
				this.preUse = pre;
				if (using) await this.useAnim(using.kind);
				if (!this.preUseUntil) this.preUse = null;
			}
			await this.playEvents(ev, fast);
			if (this.stopped) return ev;
			// 倒したら、演出中に 押しておいた 次の 攻撃は 捨てる（相手の いない 空振りに ならないように）
			if (!this.rp && ev.some((e) => e.t === "die"))
				this.ctx.input.clearField();
			// 祭りに 入ったら、そのまま 突き進まないように 止める：演出中に 押した 入力は 捨て、
			// 押さえている 向き・足踏みは 指を 離すまで 止める。自動の 歩きも やめる
			if (!this.rp && ev.some((e) => e.t === "house")) {
				this.swallowInput();
				this.walkHalt = true;
				this.restHalt = true;
				this.travel = null;
			}
			this.syncDisp();
			if (!this.rp && !run.s.end) await this.faceAttacker(ev);
			// スレの「どれに？」（メニューを通さずに来たとき）
			const pick = ev.some((e) => e.t === "fx" && e.kind === "pick");
			// （リプレイでは 次のコマンドに えらんだ相手が入っている）
			// 足元の スレは 読んだ あと 床に もどっている（core の fromFoot）
			const scroll =
				cmd.c === "use"
					? (run.findItem(cmd.item) ??
						run.f.items.find((fi) => fi.item.uid === cmd.item)?.item)
					: undefined;
			if (pick && scroll && cmd.c === "use" && !this.rp) {
				this.busy = false;
				const uid = await pickItem(this.ctx, run, "どれに　つかう？", (it) =>
					canTarget(scroll, it),
				);
				if (uid !== null)
					return this.exec({ c: "use", item: cmd.item, target: uid });
				return ev;
			}
			// 帰還スレ：「地上へ もどる？」
			const confirm = ev.some(
				(e) => e.t === "fx" && e.kind === "confirm:escape",
			);
			if (confirm && cmd.c === "use" && !this.rp) {
				this.busy = false;
				const v = await listWindow(
					this.ctx,
					"地上へ　もどりますか？<br><small>持ち物を　持って　帰れる。冒険は　ここで　おわる</small>",
					[
						{ label: "もどる", value: "go" },
						{ label: "やめる", value: "stay" },
					],
					{ start: 1 },
				);
				if (v === "go")
					return this.exec({ c: "use", item: cmd.item, target: 0 });
				return ev;
			}
			if (run.s.end) {
				await this.ending();
				return ev;
			}
			this.save();
			// 階段に乗ったら聞く（ダッシュ・タップ移動の途中では聞かない）
			const moved = before.x !== run.p.x || before.y !== run.p.y;
			if (
				!this.rp &&
				!fast &&
				moved &&
				this.onUsableStairs() &&
				!wasOnStairs &&
				!ev.some((e) => e.t === "floor")
			) {
				this.busy = false;
				await this.askStairs();
			}
		} finally {
			this.shownFloor = null;
			this.preWarp = null;
			this.preUse = this.preUseUntil = null;
			this.trapHold = null;
			this.monHold = null;
			this.busy = false;
			// ログに 追いついたら 今の 値に（あとの act が あれば そちらに まかせる）
			this.afterLog(() => {
				if (gen !== this.holdGen) return;
				this.hudHold = null;
				this.lookHold = null;
				this.hiddenItems.clear();
				this.ghostItems = [];
			});
		}
		return ev;
	}

	/**
	 * 食べる・飲む・読む演出：キリコが こちらを向き、頭の上に道具を出して動かす。
	 * パンは3口 もぐもぐ（ひと口ごとに小さくなる）、草は持ち上げて傾ける、スレは浮かんで消える。
	 */
	private async useAnim(kind: string): Promise<void> {
		const style = USE_STYLE[defOf(kind).cat];
		if (!style) return;
		const k = settings.speed === "fast" ? 0.6 : 1;
		const dur = USE_MS[style] * k;
		const pd = this.disp.get(PLAYER_ID);
		if (pd) pd.dir = 4;
		this.useFx = {
			icon: itemIcon(kind),
			style,
			t0: performance.now(),
			dur,
		};
		if (style === "eat") {
			for (let i = 0; i < 3; i++) {
				this.ctx.audio.se("eat");
				await wait(dur / 3);
			}
		} else {
			this.ctx.audio.se(style);
			await wait(dur);
		}
		this.useFx = null;
		if (pd) pd.dir = this.run.p.dir;
	}

	// ───────────────── リプレイ ─────────────────

	/** リプレイの操作（下の帯）：一時停止・速さ・次の階へ・やめる。十字キー・キーでも。 */
	private mountReplayBar(): void {
		const rp = this.rp;
		if (!rp) return;
		this.hud.root.classList.add("replay");
		this.ctx.ui.classList.add("replaying");
		const btn = (cls: string, text: string, fn: () => void) => {
			const b = el("button", { class: `rp-btn ${cls}`, text });
			b.addEventListener("pointerdown", (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.ctx.audio.unlock();
				fn();
			});
			return b;
		};
		const bar = el("div", { class: "replay-bar" }, [
			el("div", { class: "rp-head" }, [
				el("span", { class: "rp-label", text: "リプレイ" }),
				el("span", { class: "rp-where" }),
			]),
			el("div", { class: "rp-prog" }, [el("i")]),
			el("div", { class: "rp-btns" }, [
				btn("rp-play", "⏸", () => this.replayToggle()),
				btn("rp-speed", "×1", () => this.replaySpeed(1)),
				btn("rp-next", "次の階へ", () => this.replayRequestSkip()),
				btn("rp-quit", "やめる", () => void this.replayQuit()),
			]),
		]);
		rp.bar = bar;
		this.ctx.ui.appendChild(bar);
		this.updateReplayBar();
	}

	private updateReplayBar(): void {
		const rp = this.rp;
		if (!rp?.bar) return;
		const q = (c: string) => rp.bar?.querySelector(c) as HTMLElement;
		q(".rp-play").textContent = rp.paused ? "▶" : "⏸";
		q(".rp-speed").textContent = `×${rp.speed}`;
		q(".rp-where").textContent =
			`${floorShort(this.run.s.dungeon, this.run.s.depth)}　${this.run.s.turn}ターン`;
		(q(".rp-prog i") as HTMLElement).style.width =
			`${rp.total ? (rp.done / rp.total) * 100 : 100}%`;
	}

	private replayToggle(): void {
		const rp = this.rp;
		if (!rp || this.stopped) return;
		rp.paused = !rp.paused;
		this.ctx.se("cursor");
		this.updateReplayBar();
	}

	/** 速さを変える（1 → 2 → 4 → 8 → 1。step が −1 なら遅く）。 */
	private replaySpeed(step: 1 | -1): void {
		const rp = this.rp;
		if (!rp) return;
		const list = [1, 2, 4, 8];
		const i = list.indexOf(rp.speed);
		rp.speed =
			step > 0 ? list[(i + 1) % list.length] : list[Math.max(0, i - 1)];
		this.ctx.se("cursor");
		this.updateReplayBar();
	}

	/** 次のコマンドを1つ取る（あいだの指紋は ここで確かめる）。無くなった・ずれたら null。 */
	private replayNext(): Command | null {
		const rp = this.rp;
		if (!rp) return null;
		while (rp.i < rp.steps.length) {
			const st = rp.steps[rp.i++];
			if (st.kind === "cmd") {
				rp.done++;
				return st.cmd;
			}
			if (digest(this.run.s) !== st.digest) {
				rp.drift = true;
				return null;
			}
		}
		return null;
	}

	/** 毎コマ：入力の代わりに、記録のコマンドを1つずつ入れる。 */
	private replayTick(t: number): void {
		const rp = this.rp;
		if (!rp || this.stopped) return;
		const input = this.ctx.input;
		const key = input.takeField();
		if (key === "a" || key === "wait") this.replayToggle();
		else if (key === "b" || key === "menu") void this.replayQuit();
		else if (key === "map") this.toggleMap();
		const d = input.takeDirPress();
		if (d === 2) this.replaySpeed(1);
		else if (d === 6) this.replaySpeed(-1);
		else if (d === 4) this.replayRequestSkip();
		if (rp.skip) {
			rp.skip = false;
			void this.replaySkipFloor();
			return;
		}
		if (rp.paused || t < rp.nextAt) return;
		const cmd = this.replayNext();
		if (!cmd) {
			void this.replayEnd();
			return;
		}
		const fast = rp.speed >= 4;
		void this.exec(cmd, fast).then((ev) => {
			// 歩いた（向いた）だけの 手は 間を あけない（手で 歩きつづけるのと 同じ 速さ）
			const quiet =
				(cmd.c === "move" || cmd.c === "turn") &&
				ev.every((e) => e.t === "move" || e.t === "turn");
			rp.nextAt = performance.now() + (quiet ? 0 : REPLAY_GAP / rp.speed);
			this.updateReplayBar();
		});
	}

	/** 「次の階へ」：再生中の1手が終わってから とばす（毎コマの replayTick が拾う）。 */
	private replayRequestSkip(): void {
		if (!this.rp || this.stopped) return;
		this.rp.skip = true;
		this.ctx.se("cursor");
	}

	/** 次の階まで（演出なしで）とばす。 */
	private async replaySkipFloor(): Promise<void> {
		const rp = this.rp;
		if (!rp || this.busy || this.stopped) return;
		this.busy = true;
		const run = this.run;
		// 階が変わるまで（原盤を拾って帰り道になるのは 同じ階の中なので とめない）
		const depth = run.s.depth;
		try {
			while (!run.s.end && run.s.depth === depth) {
				const cmd = this.replayNext();
				if (!cmd) break;
				run.act(cmd);
			}
			// とばした あいだに ボスを たおして 終わった：ふつうに 見たときと 同じく ボスの 曲を 止めて 勝ちの 音
			// （出来事は 流さないので bossDown が 走らない。流れた ままだと 終わりの 札まで ボスの 曲が 鳴る）
			if (run.s.end?.kind === "clear" && run.bossSpec) this.bossDown();
			// とばした あいだに 見つけた ボス（出来事は 流さないので、曲と ゲージは 今の 状態から）
			this.bossShown = !!(run.boss && run.f.bossSeen);
			this.logQueue = [];
			clearTimeout(this.logTimer);
			this.resetShown();
			this.logEl.innerHTML = "";
			this.syncDisp(true);
			this.view.invalidate();
			this.updateReplayBar();
			if (run.s.end) {
				await this.ending();
				return;
			}
			if (run.s.depth !== depth) {
				this.ctx.se("stairs");
				await this.floorCard(false);
			} else await this.replayEnd();
		} finally {
			this.busy = false;
		}
	}

	private async replayQuit(): Promise<void> {
		if (!this.rp || this.stopped) return;
		this.ctx.se("cancel");
		void this.ctx.audio.fadeBgm(300);
		this.stop();
	}

	/** リプレイの終わり（最後まで見た・ずれて止まった）。タップで 村へ。 */
	private async replayEnd(): Promise<void> {
		const rp = this.rp;
		if (!rp || this.stopped) return;
		this.busy = true;
		rp.paused = true;
		this.updateReplayBar();
		const r = rp.replay;
		const end = this.run.s.end;
		// 指紋は 64手ごと なので、そのあいだで ずれて 先に 終わることも ある（記録と 終わり方が ちがう）
		const mismatch =
			!!end &&
			(end.kind !== r.kind || end.depth !== r.depth || end.turn !== r.turn);
		const line = mismatch
			? `今の版では　記録と　ちがう　ところで　終わりました<br><small>（記録では　${floorShort(this.run.s.dungeon, r.depth)}で　${esc(r.cause)}。リプレイを残したあとで ゲームの中身が 変わった）</small>`
			: rp.drift
				? "ここから先は　今の版では　同じに　ならないため、見られません<br><small>（リプレイを残したあとで ゲームの中身が 変わった）</small>"
				: end
					? end.kind === "clear" && this.run.objective === "boss"
						? `${esc(end.cause)}<br><small>${bossHomeLine(this.run.s.dungeon)}　${this.run.s.turn}ターン</small>`
						: end.kind === "clear"
							? `${defOf(this.run.dungeon.goal).name}を　持ち帰った<br><small>${this.run.s.turn}ターン</small>`
							: `${this.run.s.returning ? "帰り道の　" : ""}${floorShort(this.run.s.dungeon, end.depth)}で　${esc(end.cause)}`
					: `記録は　ここまで<br><small>（${floorShort(this.run.s.dungeon, r.depth)}で　${esc(r.cause)}）</small>`;
		const card = el("div", { class: "replay-end" }, [
			el("div", { class: "rp-end-title", text: "リプレイ　おわり" }),
			el("div", { class: "rp-end-line", html: line }),
			el("div", { class: "rp-end-hint", text: "タップで　もどる" }),
		]);
		this.ctx.ui.appendChild(card);
		await nextFrame();
		card.classList.add("shown");
		await waitOrSkip(60_000, 600);
		card.remove();
		this.ctx.input.clearField();
		this.ctx.input.takeDirPress();
		void this.ctx.audio.fadeBgm(300);
		this.stop();
	}

	/** 使える階段の上にいるか（いちばん底は、原盤を拾うまで階段が無い）。 */
	private onUsableStairs(): boolean {
		const run = this.run;
		return run.onStairs() && !run.atBottom;
	}

	private async askStairs(): Promise<void> {
		const run = this.run;
		if (this.stopped || run.s.end || !this.onUsableStairs()) return;
		// 行きは 板の 向き（下り・上り）、帰り道は その 逆
		const verb = run.s.returning
			? backVerb(run.s.dungeon)
			: goVerb(run.s.dungeon);
		const title = `階段を　${verb === "上る" ? "上り" : "降り"}ますか？`;
		this.busy = true;
		const v = await listWindow(
			this.ctx,
			title,
			[
				{ label: verb, value: "go" },
				{ label: "そのまま", value: "stay" },
			],
			{ cls: "main-menu" },
		);
		this.busy = false;
		if (v === "go") await this.exec({ c: "stairs" });
	}

	/**
	 * 祭りの 始まりの 音（encounter）を 鳴らし、祭りの 曲は それが 鳴り終わってから。
	 * それまで 階の 曲は 止めておく。待つのは 曲だけで、手番は 止めない（音は 2秒ほど ある）。
	 */
	private startHouseBgm(): void {
		this.startEncounterBgm(HOUSE_BGM);
	}

	/**
	 * 始まりの 音（encounter）の あとに その 曲（祭り・ボス）。それまで 階の 曲は 止めておく。
	 * 鳴り終わる 前に 階を 出た・冒険が 終わった・ボスを たおした なら 鳴らさない。
	 */
	private startEncounterBgm(name: string): void {
		const audio = this.ctx.audio;
		audio.bgm(null);
		audio.se("encounter");
		const span = audio.seSpan("encounter");
		const ms = span ? span.endMs - span.startMs : 0;
		clearTimeout(this.houseBgmTimer);
		this.houseBgmTimer = window.setTimeout(() => {
			if (this.stopped || floorBgm(this.run, this.bossShown) !== name) return;
			audio.bgm(name);
		}, ms);
	}

	/** ボスを たおした：ボスの 曲を 止めて 勝ちの 音（「〜を　たおした」の 行と いっしょに）。 */
	private bossDown(): void {
		if (this.stopped) return;
		this.bossShown = false;
		clearTimeout(this.houseBgmTimer);
		this.ctx.audio.bgm(null);
		this.ctx.audio.se("victory");
	}

	/**
	 * 帰り方の 演出（帰り方の 最初の 行と いっしょに。表示だけ：冒険の 状態・乱数には 触らない）。
	 * sprout・geyser・eruption：揺れて 光り、キリコが 押し上げられて 上へ 飛んでいく（カメラは 止める）。
	 * escort：「わっしょい」と かつがれて はずむ。暗転は 冒険の記録の 前（ending）。
	 */
	private async rescueScene(kind: RescueKind): Promise<void> {
		const pd = this.disp.get(PLAYER_ID);
		const look = RESCUE_LOOK[kind];
		const fast = settings.speed === "fast" || !!(this.rp && this.rp.speed >= 4);
		const k = fast ? 0.6 : 1;
		this.travel = null;
		this.camFreeze = true;
		if (kind === "escort") {
			if (pd) {
				// かつがれて はずむ（上下に 4回）
				const now = performance.now();
				const x = pd.tx;
				const y = pd.ty;
				pd.dir = 4;
				pd.keys = [{ x, y, t: now }];
				for (let i = 1; i <= 8; i++)
					pd.keys.push({ x, y: i % 2 ? y - 0.35 : y, t: now + i * 160 * k });
				this.pop({ x, y }, "わっしょい", "dup");
				void wait(640 * k).then(() => {
					if (!this.stopped) this.pop({ x, y }, "わっしょい", "dup");
				});
			}
			await this.flash(look.flash, 200 * k);
			await wait(1100 * k);
			return;
		}
		const shake = kind === "eruption" ? 700 : kind === "geyser" ? 500 : 300;
		document.body.classList.add("shake");
		const lift = pd ? { x: pd.tx, y: pd.ty } : null;
		await Promise.all([
			this.flash(look.flash, 260 * k),
			kind === "eruption" && lift
				? this.blastAt(lift, 1, k)
				: Promise.resolve(),
			wait(shake * k),
		]);
		document.body.classList.remove("shake");
		if (pd && lift && !this.stopped) {
			// 足もとから 押し上げられて 上へ（画面の 外まで）
			const now = performance.now();
			pd.dir = 4;
			pd.keys = [
				{ x: lift.x, y: lift.y, t: now },
				{ x: lift.x, y: lift.y - 0.6, t: now + 250 * k },
				{ x: lift.x, y: lift.y - 9, t: now + 900 * k },
			];
			pd.tx = lift.x;
			pd.ty = lift.y - 9;
		}
		await wait(900 * k);
	}

	private async playEvents(ev: GameEvent[], fast: boolean): Promise<void> {
		const speed = settings.speed === "fast" || fast ? 0.55 : 1;
		// 1歩の 動き（ms）。軽く 歩けるように 短め
		const stepMs = (fast ? 45 : 95) * (settings.speed === "fast" ? 0.7 : 1);
		let i = 0;
		let combat = false;
		// 行に つける 知らせ（音・回復・レベル・目的の品）。次の 行が 出るときに いっしょに 出す
		let onLine: (() => void)[] = [];
		// ボスが たおれた（この act の 中）。勝ちの 音（bossDown）が 鳴るので、たおした 音と レベルアップの 音は 鳴らさない
		// （重なって 聞こえない。レベルが 上がった ことは 行と ステータスで わかる）
		let bossFell = false;
		// 途中で閉じたら（リプレイの「やめる」）残りの出来事は流さない
		while (i < ev.length && !this.stopped) {
			const e = ev[i];
			if (
				bossFell &&
				e.t === "se" &&
				(e.name === "enemyDown" || e.name === "levelup")
			) {
				i++;
				continue;
			}
			// 敵が 起きた・眠った（Z・置物の 絵）。行が 続けば その 行と いっしょに、続かなければ すぐ
			// （杖で 起こした 敵は「足が おそくなった」と いっしょに 起き、炎を 吐く ときには もう 起きている）
			if (e.t === "stir") {
				const look = { asleep: e.asleep, posing: e.posing };
				const apply = () => {
					this.monHold?.set(e.id, look);
					// 姿（改変の杖など）。変わった 行と いっしょに 絵を 変える
					const d = this.disp.get(e.id);
					const def = MONSTERS[e.kind];
					if (d && def) {
						d.sprite = e.sprite;
						d.scale = def.scale;
					}
				};
				if (leadsToLine(ev, i)) onLine.push(apply);
				else apply();
				i++;
				continue;
			}
			// 知らせ（動きでは ない もの）は、それを 伝える 行と いっしょに・前の 行が 出てから 出す。
			// 行より 先に ごほうびが 見えたり 音が 鳴ったり しないように（動きと 戦いは 今までどおり すぐ）
			if (e.t === "se" || LEAD.has(e.t) || e.t === "item") {
				const prev = besideOf(ev, i, -1);
				const next = besideOf(ev, i, 1);
				const motionSound =
					e.t === "se" &&
					((prev && MOTION.has(prev.t)) ||
						(next && MOTION.has(next.t) && !leadsToLine(ev, i)));
				if (!motionSound) {
					if (LEAD.has(e.t) && leadsToLine(ev, i)) {
						onLine.push(() => this.showNotice(e));
						i++;
						continue;
					}
					await this.logDrained();
					if (this.stopped) break;
					this.showNotice(e);
					i++;
					continue;
				}
			}
			// 行の あとの 動き（飲んだ・読んだ の あとの 敵の 攻撃・傷・ワープ など）は、前の 行が 出てから。
			// 道具の 効き目（行と 音）より 先に 敵が 動いて 見えないように。
			// 動きに 続く 行（攻撃 → ダメージの 行 → 敵の 攻撃）は 待たない（戦いの 手ざわりは そのまま）。
			// ただし 杖の 弾の あとの 行（「〜に　変わった！」など）は 弾の 効き目なので 待つ
			const prevEv = besideOf(ev, i, -1);
			const lineAfter =
				MOTION.has(e.t) &&
				!!prevEv &&
				(prevEv.t === "msg" || LEAD.has(prevEv.t));
			if (
				(e.t === "hurt" || lineAfter) &&
				(!afterMotion(ev, i) || (lineAfter && deedBefore(ev, i) === "bolt"))
			) {
				await this.logDrained();
				if (this.stopped) break;
			}
			// 続けて動く出来事はまとめて同時に動かす（倍速の2歩も、同じ時間の中で 通るマスをたどる）
			if (e.t === "move") {
				const now = performance.now();
				let j = i;
				const paths = new Map<number, Pos[]>();
				let shown = false;
				while (j < ev.length && (ev[j].t === "move" || ev[j].t === "turn")) {
					const m = ev[j];
					if (m.t !== "move" && m.t !== "turn") break;
					const d = this.disp.get(m.id);
					if (d) d.dir = m.dir;
					if (m.t === "move") {
						const path = paths.get(m.id) ?? [];
						path.push(m.to);
						paths.set(m.id, path);
						if (this.moveShown(m.id)) shown = true;
					}
					j++;
				}
				let end = now;
				// 先行入力が あれば 1歩も 短く（動いて 見えるぶんは 残す）
				const sm = this.hurried() ? Math.min(stepMs, 40) : stepMs;
				for (const [id, path] of paths) {
					const d = this.disp.get(id);
					if (!d) continue;
					// 前の1歩の終わりぎわに続けて動くなら、その道のりの後ろに足す。そうでなければ 今の所から
					const last = d.keys[d.keys.length - 1];
					const lag = now - last.t;
					const t0 = d.keys.length > 1 && lag > -25 && lag < 50 ? last.t : now;
					const keys =
						t0 === now
							? [{ x: d.fx, y: d.fy, t: now }]
							: d.keys.filter(
									(_, i, a) => i === a.length - 1 || a[i + 1].t > now - 50,
								);
					path.forEach((q, i) => {
						keys.push({
							x: q.x,
							y: q.y,
							t: t0 + (sm * (i + 1)) / path.length,
						});
					});
					d.keys = keys;
					d.tx = path[path.length - 1].x;
					d.ty = path[path.length - 1].y;
					if (this.moveShown(id)) end = Math.max(end, t0 + sm);
				}
				// 見えない所の動きは待たない。見える動きも 1コマぶん早めに次へ進める（次の1歩が 続きから動けるように）
				if (shown) await this.beat(end - performance.now() - FRAME_MS);
				if (paths.has(PLAYER_ID)) this.trapHold = null;
				i = j;
				continue;
			}
			i++;
			switch (e.t) {
				case "msg":
					// 拾った 行が 出たら、足もとに 残して 描いていた 道具（ghostItems）を その場で 消す
					// （act の ログが ぜんぶ 出るまで 待つと、拾った あとも しばらく 残像のように 見えていた）
					if (e.text.endsWith("を　拾った")) {
						const at = { x: this.run.p.x, y: this.run.p.y };
						onLine.push(() => {
							this.ghostItems = this.ghostItems.filter(
								(g) => g.x !== at.x || g.y !== at.y,
							);
						});
					}
					// 前の行から 間を空けて 1行ずつ 出す（読めるように。待つのは ログだけで、次の 1歩は 待たない）
					this.logQueue.push({
						text: e.text,
						tone: e.tone,
						fast,
						with: onLine.length ? onLine : undefined,
					});
					onLine = [];
					this.pumpLog();
					break;
				case "se":
					this.showNotice(e);
					break;
				case "turn": {
					const d = this.disp.get(e.id);
					if (d) {
						d.dir = e.dir;
						// 長押しで 壁に 押しつづける あいだは 最初の 1回だけ（くり返すと 虚空を 突いて 見える）
						if (e.bump) {
							const now = performance.now();
							if (now - (d.bumpLast ?? -1e9) > 300) d.bumpT0 = now;
							d.bumpLast = now;
						}
					}
					break;
				}
				case "attack": {
					const d = this.disp.get(e.id);
					if (d) {
						d.dir = e.dir;
						d.lungeT0 = performance.now();
					}
					combat = true;
					await this.beat(90 * speed);
					break;
				}
				case "hurt": {
					if (e.id === PLAYER_ID && e.hp !== undefined && this.hudHold)
						this.hudHold.hp = e.hp;
					// ボスの ゲージは 傷の たびに 減らす（ゲージは act の 前の 値から）
					const hb = this.hudHold?.boss;
					if (hb && e.id === this.bossUid)
						this.hudHold = {
							...(this.hudHold as HudView),
							boss: { ...hb, hp: Math.max(0, hb.hp - e.amount) },
						};
					const d = this.disp.get(e.id);
					if (d) d.flashUntil = performance.now() + 260;
					if (this.isShown(e.id, e.pos))
						this.pop(
							e.pos,
							String(e.amount),
							e.id === PLAYER_ID ? "hurt-player" : "",
						);
					// 最大HPの 2割 以上 削られたら 画面を 1回 小さく ゆらす（点滅と 数字だけだと、音を 消した
					// スマホでは 痛手が 伝わりにくい。小さな 傷では ゆらさない）
					if (
						e.id === PLAYER_ID &&
						e.amount >= Math.max(3, this.run.p.maxHp * 0.2)
					)
						this.jolt();
					combat = true;
					await this.beat(70 * speed);
					break;
				}
				case "miss":
					if (this.isShown(e.id, e.pos)) this.pop(e.pos, "ミス", "miss");
					combat = true;
					await this.beat(60 * speed);
					break;
				case "die": {
					const d = this.disp.get(e.id);
					if (d) {
						d.dying = true;
						d.fadeT0 = performance.now();
					}
					// ボスを たおした：勝ちの 音は「〜を　たおした」の 行と いっしょに
					if (e.id === this.bossUid) {
						this.bossUid = null;
						bossFell = true;
						const hb = this.hudHold?.boss;
						if (hb && this.hudHold)
							this.hudHold = { ...this.hudHold, boss: { ...hb, hp: 0 } };
						onLine.push(() => this.bossDown());
					}
					await this.beat(120 * speed);
					break;
				}
				case "appear": {
					// ふえた敵だけ足す（ほかのキャラの動きの途中を崩さない）
					const m = this.run.f.monsters.find((x) => x.uid === e.id);
					if (m && !this.disp.has(e.id)) {
						// 見えていれば もとの敵の マスから 光って 分かれ出る（コピペ。ふえたのが わかるように）
						const from = e.from && this.run.monsterVisible(m) ? e.from : null;
						const now = performance.now();
						this.disp.set(e.id, {
							id: e.id,
							sprite: monsterSprite(m),
							scale: mdef(m).scale,
							fx: from?.x ?? e.pos.x,
							fy: from?.y ?? e.pos.y,
							tx: e.pos.x,
							ty: e.pos.y,
							keys: from
								? [
										{ x: from.x, y: from.y, t: now },
										{ x: e.pos.x, y: e.pos.y, t: now + SPLIT_MS },
									]
								: [{ x: e.pos.x, y: e.pos.y, t: 0 }],
							dir: m.dir,
							lunge: 0,
							lungeT0: 0,
							flashUntil: from ? now + SPLIT_MS + 260 : 0,
							fade: 0,
							fadeT0: 0,
							dying: false,
						});
						if (from) {
							const orig = [...this.disp.values()].find(
								(d) => d.id !== e.id && d.tx === from.x && d.ty === from.y,
							);
							if (orig) orig.flashUntil = now + SPLIT_MS + 260;
							this.pop(from, "コピペ", "dup");
							await this.beat(SPLIT_MS + 60);
						}
					}
					break;
				}
				case "warp": {
					const d = this.disp.get(e.id);
					if (d) {
						d.tx = d.fx = e.to.x;
						d.ty = d.fy = e.to.y;
						d.keys = [{ x: e.to.x, y: e.to.y, t: 0 }];
					}
					// キリコが 着いたので、ここから ワープ先の 見え方に
					if (e.id === PLAYER_ID) this.preWarp = this.trapHold = null;
					await this.beat(80 * speed);
					break;
				}
				case "bolt":
					await this.flyBolt(e, this.hurried() ? speed * 0.4 : speed);
					// 振った 弾・投げた 物が 着いてから 効き目を 見せる
					if (this.preUseUntil === "bolt")
						this.preUse = this.preUseUntil = null;
					break;
				case "fx":
					// 爆発（地雷・炎上案件）は その場に 火の玉も 出す（見えている ときだけ）。
					// 炎上スレ（blast）は 焼かれる 敵 1匹ずつに 小さい 火の玉を いっせいに
					if (e.kind === "explosion" && this.run.playerSees(e.pos))
						await Promise.all([
							this.flash("rgba(255,160,60,0.45)", 160),
							this.blastAt(e.pos, e.r ?? 1, fast ? 0.4 : speed),
						]);
					else if (e.kind === "blast") {
						const seen = (e.at ?? []).filter((q) => this.run.playerSees(q));
						await Promise.all([
							this.flash("rgba(255,160,60,0.45)", 160),
							...seen.map((q) => this.blastAt(q, 0.5, fast ? 0.4 : speed)),
						]);
					} else if (e.kind === "explosion")
						await this.flash("rgba(255,160,60,0.6)", 220);
					// 蓄音機の 再生：画面が 一瞬 セピアに
					else if (e.kind === "voice")
						await this.flash("rgba(200,160,90,0.35)", fast ? 80 : 260);
					// 敵の 特技：使った 敵が 光り、画面に その色。音の 区切りまで 待ってから 効き目の 行へ
					else if (e.kind.startsWith("skill:")) {
						const [color, label] = SKILL_LOOK[e.kind.slice(6)] ?? [
							"rgba(255,255,255,0.3)",
							"",
						];
						const shown = this.run.playerSees(e.pos);
						const d = [...this.disp.values()].find(
							(x) => x.id !== PLAYER_ID && x.tx === e.pos.x && x.ty === e.pos.y,
						);
						if (d && shown) d.flashUntil = performance.now() + 420 * speed;
						if (shown && label) this.pop(e.pos, label, "skill");
						const hurry = fast || this.hurried();
						await this.flash(color, hurry ? 80 : 300);
						combat = true;
						if (!hurry) await this.ctx.audio.seSettled();
					}
					break;
				case "floor":
					await this.floorCard(false);
					break;
				case "house":
					this.startHouseBgm();
					// 祭りに 気づく 間（走っている 途中でも 止めて 見せる。早送りの リプレイだけ 待たない）
					if (!(this.rp && fast)) await wait(HOUSE_PAUSE_MS);
					break;
				case "sleep":
					if (e.id === PLAYER_ID) {
						// 眠っている あいだは Z を 出したまま。目が さめたら 少し 見せてから 起こす
						if (e.on) this.sleepShown = true;
						if (!fast) await wait((e.on ? 500 : 400) * speed);
						if (!e.on) this.sleepShown = false;
					}
					break;
				case "doze":
					// 眠っている 1ターンごとに 区切る（敵の 動きが 1ターンずつ 見えるように）
					if (!fast) await this.beat(260 * speed);
					break;
				case "quake":
					document.body.classList.add("shake");
					await wait(e.level >= 3 ? 700 : 400);
					document.body.classList.remove("shake");
					if (e.level >= 3)
						await this.overThread(
							ev.slice(i).some((x) => x.t === "floor"),
							fast,
						);
					break;
				case "reveal":
					this.preUse = this.preUseUntil = null;
					// わかった所は 地図に 載る。地図を 閉じていれば ひとこと（記録の ログには 残さない）
					if (!this.mapOn) {
						this.logQueue.push({ text: "地図を　開いて　みよう", fast });
						this.pumpLog();
					}
					break;
				case "end":
					break;
			}
		}
		// （行が 来ずに 残った 知らせは ログに 追いついたら）
		if (onLine.length) {
			const rest = onLine;
			this.afterLog(() => {
				for (const fn of rest) fn();
			});
		}
		// 戦いの音が鳴っていたら、その区切りまで次の行動を待つ（連打で音が重ならないように）
		if (combat && !fast) await this.ctx.audio.seSettled();
	}

	/** 知らせを 出す：音を 鳴らす・回復の 数字・レベル・目的の品の 曲・安価・床に 置かれた 道具。 */
	private showNotice(e: GameEvent): void {
		if (this.stopped) return;
		switch (e.t) {
			case "se":
				// 全滅の音は、倒れる演出で 墓が落ちたときに鳴らす
				if (e.name === "wipeout" && this.run.s.end?.kind === "dead") return;
				// 祭りの 始まりの 音は「house」で 曲と 合わせて 鳴らした
				if (e.name === "encounter") return;
				this.ctx.audio.se(e.name);
				// 持ち帰って 最後の 階段を 上った：音と いっしょに キリコを 消す（地上へ 帰っていく）
				if (e.name === "stairs" && this.run.s.end?.kind === "clear") {
					const pd = this.disp.get(PLAYER_ID);
					if (pd) pd.fade = 1;
				}
				return;
			case "heal":
				if (e.id === PLAYER_ID && e.hp !== undefined && this.hudHold)
					this.hudHold.hp = e.hp;
				this.pop(e.pos, `+${e.amount}`, "heal");
				return;
			case "look":
				this.lookHold = null;
				return;
			case "levelup": {
				if (this.hudHold) {
					this.hudHold.lv = e.lv;
					this.hudHold.hp = e.hp;
					this.hudHold.maxHp = e.maxHp;
				}
				// キリコの 頭の 上に 大きく（ログの 1行と 音だけだと、音を 消して 遊ぶ スマホでは 気づかなかった）
				const pd = this.disp.get(PLAYER_ID);
				if (pd) this.pop({ x: pd.fx, y: pd.fy }, "レベルアップ！", "lvup");
				return;
			}
			case "goal":
				this.ctx.audio.bgm(floorBgm(this.run, this.bossShown));
				if (this.hudHold) this.hudHold.returning = true;
				return;
			case "boss": {
				// ボスを 見つけた：始まりの 音 → ボスの 曲。ゲージも ここから（その 行と いっしょに）
				this.bossShown = true;
				this.startEncounterBgm(BOSS_BGM);
				const live = this.liveHud().boss;
				if (this.hudHold && live)
					this.hudHold = { ...this.hudHold, boss: live };
				return;
			}
			case "rescue":
				this.rescueFx = this.rescueScene(e.kind);
				return;
			case "baton": {
				// 解音ゼロの バトンタッチ：次の 機体が 光って 立つ（絵は 状態から。core/run.ts の batonTouch）
				const pd = this.disp.get(PLAYER_ID);
				if (pd) {
					pd.flashUntil = performance.now() + 600;
					this.pop({ x: pd.fx, y: pd.fy }, "バトンタッチ！", "lvup");
				}
				return;
			}
			case "anka":
				if (this.hudHold) {
					const { anka, ankaLine, ankaLeft } = this.liveHud();
					Object.assign(this.hudHold, { anka, ankaLine, ankaLeft });
				}
				return;
			case "item":
				this.hiddenItems.delete(e.uid);
				return;
		}
	}

	/** その動きが画面に見えているか（見えない敵・視界の外は待たない）。 */
	private moveShown(id: number): boolean {
		if (id === PLAYER_ID) return true;
		const m = this.run.f.monsters.find((x) => x.uid === id);
		return !!m && !m.disguise && !posing(m) && this.run.monsterVisible(m);
	}

	private isShown(id: number, pos: Pos): boolean {
		if (id === PLAYER_ID) return true;
		return this.run.playerSees(pos);
	}

	private async flyBolt(
		e: Extract<GameEvent, { t: "bolt" }>,
		speed: number,
	): Promise<void> {
		const n = Math.max(1, dist(e.from, e.to));
		const fire = e.kind === "fire";
		// 炎は 帯なので となりでも 見える 長さに（矢・杖は 今までどおり）
		const ms =
			(fire ? Math.min(480, 220 + n * 40) : Math.min(420, n * 38)) * speed;
		const proj: Projectile = {
			x: e.from.x,
			y: e.from.y,
			icon: e.kind === "item" && e.icon ? itemIcon(e.icon) : null,
			color:
				e.kind === "fire"
					? "#ff7a3a"
					: e.kind === "staff"
						? "#a8e0ff"
						: "#f4f1ff",
			flame: fire ? { x: e.from.x, y: e.from.y, alpha: 1 } : undefined,
		};
		this.projectiles.push(proj);
		const t0 = performance.now();
		// 炎は 先が 早く 伸びきって、しばらく 燃えてから 消える
		const reach = fire ? ms * 0.45 : ms;
		for (;;) {
			const elapsed = performance.now() - t0;
			const k = Math.min(1, elapsed / reach);
			proj.x = e.from.x + (e.to.x - e.from.x) * k;
			proj.y = e.from.y + (e.to.y - e.from.y) * k;
			if (proj.flame)
				proj.flame.alpha =
					elapsed < ms * 0.7
						? 1
						: Math.max(0, 1 - (elapsed - ms * 0.7) / (ms * 0.3));
			if (elapsed >= ms) break;
			await nextFrameP();
		}
		this.projectiles = this.projectiles.filter((p) => p !== proj);
	}

	/** 爆発の 火の玉（ふくらんで、けむりを 残して 消える）。 */
	private async blastAt(pos: Pos, r: number, speed: number): Promise<void> {
		const ms = 620 * speed;
		const proj: Projectile = {
			x: pos.x,
			y: pos.y,
			icon: null,
			color: "",
			blast: { r, k: 0 },
		};
		this.projectiles.push(proj);
		const t0 = performance.now();
		for (;;) {
			const k = Math.min(1, (performance.now() - t0) / ms);
			if (proj.blast) proj.blast.k = k;
			if (k >= 1) break;
			await nextFrameP();
		}
		this.projectiles = this.projectiles.filter((p) => p !== proj);
	}

	private async flash(color: string, ms: number): Promise<void> {
		const f = el("div", { class: "flash" });
		f.style.background = color;
		this.ctx.ui.appendChild(f);
		await wait(ms);
		f.remove();
	}

	/**
	 * 安価が 来た：前の レス（名無し）が「>>今の レス番　が　〜」と 取っていた、という 2ch の 形で
	 * 上の方に しばらく 出す（操作は とめない）。前の レス番は 乱数を 使わず 今の レス番から 決める。
	 */
	private async ankaPost(text: string, at: number): Promise<void> {
		const from = Math.max(1, at - 3 - ((at * 7) % 17));
		const post = el("div", { class: "over1000 anka-post" }, [
			el("div", { class: "over1000-head" }, [
				`${from} ：`,
				el("b", { text: "名無しさん@おんJ" }),
			]),
			el("div", { class: "over1000-body" }, [
				el("span", { class: "anka-to", text: `>>${at}` }),
				`　が　${text}`,
			]),
			el("div", {
				class: "over1000-body anka-note",
				text: `（${ANKA_DUE}レス　以内に。安価は　絶対）`,
			}),
		]);
		this.ctx.ui.appendChild(post);
		await nextFrame();
		post.classList.add("shown");
		await wait(settings.speed === "fast" ? 1400 : 2400);
		post.classList.remove("shown");
		await wait(300);
		post.remove();
	}

	/** 階の札（〇階）。 */
	/**
	 * 地震の3回目：2ch の 1001 のように「このスレッドは1000を超えました」が書きこまれ、
	 * もう書けないので 下の階へ 落ちる（画面ごと 沈んで 暗くなり、つぎの階の札へ）。
	 */
	private async overThread(falls: boolean, fast: boolean): Promise<void> {
		const post = el("div", { class: "over1000" }, [
			el("div", { class: "over1000-head" }, [
				"1001 ：",
				el("b", { text: "１００１" }),
				"：Over 1000 Thread",
			]),
			el("div", {
				class: "over1000-body",
				text: "このスレッドは１０００を超えました。",
			}),
			el("div", {
				class: "over1000-body",
				text: falls
					? isUpBoard(this.run.s.dungeon)
						? "もう書けないので、上の階へ押し出されます。。。"
						: "もう書けないので、下の階へ落ちます。。。"
					: isUpBoard(this.run.s.dungeon)
						? "もう書けませんが、これより上は　ありません。。。"
						: "もう書けませんが、これより下は　ありません。。。",
			}),
		]);
		this.ctx.ui.appendChild(post);
		await nextFrame();
		post.classList.add("shown");
		await wait(fast ? 500 : 1600);
		if (this.stopped) {
			post.remove();
			return;
		}
		if (falls) {
			post.classList.add("falling");
			this.fadeEl.style.transition = "opacity 0.45s";
			this.fadeEl.style.opacity = "1";
		} else post.classList.remove("shown");
		await wait(460);
		post.remove();
	}

	private async floorCard(first: boolean): Promise<void> {
		const run = this.run;
		this.shownFloor = null;
		// 新しい 階の ステータスに（前の 階の 床の 道具の 写しは 捨てる）
		if (this.hudHold) this.hudHold = this.liveHud();
		this.lookHold = null;
		this.hiddenItems.clear();
		this.ghostItems = [];
		this.lastTravel = null;
		this.view.invalidate();
		this.syncDisp(true);
		this.travel = null;
		this.fadeEl.style.transition = "none";
		this.fadeEl.style.opacity = "1";
		const up = run.s.returning;
		// ボスの 待つ いちばん底は 副題で 知らせる
		const boss = run.boss;
		const card = el("div", { class: "chapter shown" }, [
			el("div", {
				class: "chapter-label",
				text: `${up ? "帰り道　" : ""}${zoneFor(run.s.dungeon, run.s.depth).name}`,
			}),
			el("div", {
				class: "chapter-title",
				text: floorLong(run.s.dungeon, run.s.depth),
			}),
			el("div", {
				class: "chapter-sub",
				text: up
					? `${isUpBoard(run.s.dungeon) ? "下り" : "上り"}階段を　さがそう`
					: boss
						? `${mdef(boss).name}が　待ちかまえている`
						: zoneFor(run.s.dungeon, run.s.depth).note
							? (zoneFor(run.s.dungeon, run.s.depth).note ?? "")
							: run.s.depth >= run.dungeon.floors
								? isUpBoard(run.s.dungeon)
									? "いちばん　上"
									: "いちばん　底"
								: "",
			}),
		]);
		this.ctx.ui.appendChild(card);
		// 次の 階も 同じ 曲なら 止めずに 流しつづける（板の 曲は 全部の 階で 同じ。階段の たびに 頭から
		// 鳴らしなおすと、20〜30階の 板で 同じ 出だしを 何十回も 聞くことに なった）
		if (!first && this.ctx.audio.currentBgm !== floorBgm(run, this.bossShown))
			await this.ctx.audio.fadeBgm(300);
		await wait(first ? 900 : 1100);
		if (this.stopped) {
			card.remove();
			return;
		}
		this.ctx.audio.bgm(floorBgm(run, this.bossShown));
		card.classList.remove("shown");
		this.fadeEl.style.transition = "opacity 0.35s";
		await nextFrame();
		this.fadeEl.style.opacity = "0";
		await wait(360);
		card.remove();
		this.save(true);
		this.storyLog(first);
	}

	/**
	 * 裏シナリオの 筋を 忘れないための 行（data/synopsis.ts）。潜りはじめ・続きからは 目的と わけ、
	 * 途中の 決まった 階では 村の スレの レスか 地の文。持ち帰る 前の 下りだけ（リプレイでは 出さない）。
	 */
	private storyLog(first: boolean): void {
		const s = this.run.s;
		if (this.rp || s.returning) return;
		const cleared = loadProgress().cleared;
		const why = goalWhy(s.dungeon, cleared);
		if (first && why) {
			this.addLog(`目的：${goalText(s.dungeon, this.run.objective)}`);
			this.addLog(why, "gloss");
		}
		const r = diveResAt(s.dungeon, s.depth, cleared);
		if (r) this.addLog(diveResLine(r), "gloss");
	}

	private async ending(): Promise<void> {
		const s = this.run.s;
		this.busy = true;
		if (s.end?.kind === "dead") await this.deathScene();
		else if (s.end?.kind === "clear" && this.run.bossSpec) {
			// ボスを たおして 帰る：帰り方の 行と 演出（その 行で 始まる）が 終わるのを 待って、その 色で 暗転
			await this.logDrained();
			await this.rescueFx;
			this.rescueFx = null;
			// 最後の 行を 読む 間
			await wait(500);
			if (this.stopped) return;
			const look = RESCUE_LOOK[this.run.bossSpec.rescue];
			this.fadeEl.style.background = look.fade;
			this.fadeEl.style.transition = "opacity 0.5s";
			await nextFrame();
			this.fadeEl.style.opacity = "1";
			await wait(700);
		} else await wait(700);
		if (this.rp) {
			await this.replayEnd();
			return;
		}
		// 冒険の記録の 札と いっしょに 下も 暗くする（札が 消えるとき ダンジョンが 一瞬 見えないように。
		// ボスの 帰りは もう その 色で 暗い）
		if (this.fadeEl.style.opacity !== "1") {
			this.fadeEl.style.transition = "opacity 0.8s";
			this.fadeEl.style.opacity = "1";
		}
		await showRunEnd(this.ctx, s);
		this.stop();
	}

	/**
	 * 倒れたときの演出：キリコが くるくる回って消え、その場に墓が落ちてくる。
	 * 画面の色が抜けて、どこで何に倒されたかを出す。タップ・キーで先へ。
	 */
	private async deathScene(): Promise<void> {
		const run = this.run;
		const end = run.s.end;
		if (!end) return;
		void this.ctx.audio.fadeBgm(600);
		const pd = this.disp.get(PLAYER_ID);
		await wait(250);
		if (pd) {
			pd.flashUntil = performance.now() + 420;
			for (const d of [4, 6, 0, 2, 4, 6, 0, 2, 4] as Dir8[]) {
				pd.dir = d;
				await wait(65);
			}
			pd.dying = true;
			pd.fadeT0 = performance.now();
		}
		this.grave = { x: run.p.x, y: run.p.y, t0: performance.now() + 120 };
		await wait(120 + GRAVE_DROP_MS * 0.7);
		// リプレイを「やめる」で閉じたあとなら ここで終わる（村の上に出さない・色を抜かない）
		if (this.stopped) return;
		this.ctx.audio.se("wipeout");
		this.screen.canvas.classList.add("dead");
		const scene = el("div", { class: "death" }, [
			el("div", {
				class: "death-title",
				text: `${this.run.heroName}は　たおれた`,
			}),
			el("div", {
				class: "death-cause",
				text: `${end.depth === 0 ? "" : `${run.s.returning ? "帰り道の　" : ""}${floorLong(run.s.dungeon, end.depth).replace("　", "")}で　`}${end.cause}`,
			}),
		]);
		this.ctx.ui.appendChild(scene);
		this.deathEl = scene;
		await nextFrame();
		scene.classList.add("shown");
		await waitOrSkip(3200, 900);
		this.ctx.input.clearField();
		this.ctx.input.takeDirPress();
		scene.remove();
	}

	// ───────────────── ダッシュ・タップ移動 ─────────────────

	/**
	 * 何かあったら止まるかどうか（ダッシュ・タップ移動）。
	 * tapped：タップで決めた 自動移動は 敵が 見えただけでは 止まらない（ねらわれたら 止まる）。
	 */
	private shouldStop(
		before: { monsters: number; room: number },
		ev: GameEvent[],
		dash = true,
		tapped = false,
	): boolean {
		const run = this.run;
		if (run.s.end) return true;
		if (ev.some((e) => e.t === "msg" && e.tone === "warn")) return true;
		if (ev.some((e) => e.t === "hurt" || e.t === "floor" || e.t === "warp"))
			return true;
		const p = run.p;
		if (run.itemAt(p.x, p.y) || this.onUsableStairs()) return true;
		const vis = run.f.monsters.filter(
			(m) => run.monsterVisible(m) && !m.disguise && !posing(m),
		).length;
		if (!tapped && vis > before.monsters) return true;
		// タップの 自動移動は、見えている敵が となりに 来たら 止まる（先に なぐられないように）
		if (
			tapped &&
			run.f.monsters.some(
				(m) =>
					run.monsterVisible(m) &&
					!m.disguise &&
					!posing(m) &&
					dist(m, p) === 1,
			)
		)
			return true;
		// 敵に ねらわれた（なぐられた・撃たれた）ら止まる。はずれても止まる
		if (
			ev.some(
				(e) =>
					(e.t === "attack" && e.id !== PLAYER_ID) ||
					(e.t === "miss" && e.id === PLAYER_ID),
			)
		)
			return true;
		// ダッシュは 部屋に 入ったら 止まる（行き先を決めたタップ移動は止まらない）。
		// 部屋から 通路へは 入口の 手前で 止まる（dashSteps）ので、通路に 出た ところでは 止まらない
		const room = roomAt(run.f.layout, p.x, p.y);
		if (dash && room >= 0 && room !== before.room) return true;
		if (p.hp <= p.maxHp / 3) return true;
		return false;
	}

	private snapshot(): { monsters: number; room: number } {
		const run = this.run;
		return {
			monsters: run.f.monsters.filter(
				(m) => run.monsterVisible(m) && !m.disguise && !posing(m),
			).length,
			room: roomAt(run.f.layout, run.p.x, run.p.y),
		};
	}

	/** d の向きに、何かあるまで走る。階段に乗って止まったら 聞く。tapped は タップで 走りだした（敵が 見えても 止まらない）。 */
	private async dash(d: Dir8, tapped = false): Promise<void> {
		const wasOnStairs = this.onUsableStairs();
		this.dashing = true;
		try {
			await this.dashSteps(d, tapped);
		} finally {
			this.dashing = false;
		}
		if (
			!wasOnStairs &&
			this.onUsableStairs() &&
			!this.stopped &&
			!this.run.s.end
		)
			await this.askStairs();
	}

	private async dashSteps(d: Dir8, tapped: boolean): Promise<void> {
		const run = this.run;
		// 混乱しているときは走らない（1歩だけ）
		if (run.p.status.confuse > 0) {
			await this.exec({ c: "move", dir: d });
			return;
		}
		let dir = d;
		const serial = this.ctx.input.serial;
		// 走りだす 前から 階段の となりなら、その 階段では 止まらない
		let nearStairs = this.besideStairs();
		for (let n = 0; n < 60; n++) {
			if (this.stopped) return;
			// 走っているあいだに 何かに さわったら 止まる（さわった入力は 捨てる）
			if (n > 0 && this.ctx.input.serial !== serial) {
				this.swallowInput();
				return;
			}
			const snap = this.snapshot();
			if (n > 0 && snap.monsters > 0 && !tapped) return;
			if (
				!run.canStepTerrain(run.p, dir) ||
				run.monsterAt(step(run.p, dir).x, step(run.p, dir).y)
			) {
				// 通路の曲がり角はついていく
				if (n === 0 || roomAt(run.f.layout, run.p.x, run.p.y) >= 0) return;
				const ways = DIRS8.filter(
					(x) =>
						x !== (dir + 4) % 8 &&
						run.canStepTerrain(run.p, x) &&
						!isDiagonal(x),
				);
				if (ways.length !== 1) return;
				dir = ways[0];
			}
			const from = { x: run.p.x, y: run.p.y };
			const ev = await this.exec({ c: "move", dir }, true);
			if (!ev.length || this.shouldStop(snap, ev, true, tapped)) break;
			// 階段の となりに 来たら 止まる（通りすぎて 見のがさない）
			const near = this.besideStairs();
			if (near && !nearStairs) break;
			nearStairs = near;
			// 部屋の中で、通路の 入口の 前に 来たら 止まる（来た 方の 通路は のぞく）
			if (this.atCorridorMouth(from)) break;
			// 通路の分かれ道で止まる
			if (roomAt(run.f.layout, run.p.x, run.p.y) < 0) {
				const ways = DIRS8.filter(
					(x) => !isDiagonal(x) && run.canStepTerrain(run.p, x),
				).length;
				if (ways > 2) break;
			}
		}
	}

	/** 使える 階段が となり（ななめも）に 見えている。乗っている ときは 別（乗れば shouldStop で 止まる）。 */
	private besideStairs(): boolean {
		const run = this.run;
		const st = run.f.stairs;
		if (run.atBottom || run.onStairs()) return false;
		if (!run.f.seen[st.y * run.f.layout.w + st.x]) return false;
		return dist(run.p, st) === 1;
	}

	/** 部屋の 中で、上下左右の となりに 通路の 入口が ある（from から 来た 通路は 数えない）。 */
	private atCorridorMouth(from: Pos): boolean {
		const run = this.run;
		const l = run.f.layout;
		if (roomAt(l, run.p.x, run.p.y) < 0) return false;
		return DIRS8.some((x) => {
			if (isDiagonal(x)) return false;
			const n = step(run.p, x);
			if (n.x === from.x && n.y === from.y) return false;
			return isFloor(l, n.x, n.y) && roomAt(l, n.x, n.y) < 0;
		});
	}

	/** タップした所へ1歩進む（知っている床だけを通る）。 */
	private async travelStep(): Promise<void> {
		const run = this.run;
		const to = this.travel;
		if (!to) return;
		if (to.x === run.p.x && to.y === run.p.y) {
			this.travel = null;
			await this.askStairs();
			return;
		}
		// 混乱しているときは、タップした方へ1歩だけ（敵が 見えていても 歩きつづける。ねらわれたら 止まる）
		const snap = this.snapshot();
		const d = this.pathStep(to);
		if (d === null) {
			this.travel = null;
			return;
		}
		if (run.p.status.confuse > 0) this.travel = null;
		const wasOnStairs = this.onUsableStairs();
		const ev = await this.exec({ c: "move", dir: d }, true);
		if (this.stopped || run.s.end) {
			this.travel = null;
			return;
		}
		// 階段に乗ったら、行き先の途中でも・敵がいても 聞く（なぐられた1歩でも）
		if (
			!wasOnStairs &&
			this.onUsableStairs() &&
			ev.some((e) => e.t === "move" && e.id === PLAYER_ID)
		) {
			this.travel = null;
			await this.askStairs();
			return;
		}
		if (!ev.length || this.shouldStop(snap, ev, false, true)) {
			const arrived = run.p.x === to.x && run.p.y === to.y;
			this.travel = null;
			this.lastTravel = arrived ? null : to;
			if (arrived || snap.monsters === 0) await this.askStairs();
		}
	}

	private pathStep(to: Pos): Dir8 | null {
		const run = this.run;
		const f = run.f;
		const l = f.layout;
		const w = l.w;
		const start = run.p.y * w + run.p.x;
		const goal = to.y * w + to.x;
		const prev = new Int32Array(l.w * l.h).fill(-2);
		prev[start] = -1;
		const q = [start];
		const traps = new Set(
			f.traps.filter((t) => t.found).map((t) => t.y * w + t.x),
		);
		// 同じ 手数の 道なら、行き先の 向きに 近い 1歩を 先に 調べる（上・右上…の 決まった 順だと、
		// 2マス 右へ「右上→右下」と 遠回りに 見える 道を 選んでいた）
		const ga = Math.atan2(to.y - run.p.y, to.x - run.p.x);
		const off = (d: Dir8): number => {
			const v = step({ x: 0, y: 0 }, d);
			const t = Math.abs(Math.atan2(v.y, v.x) - ga) % (2 * Math.PI);
			return Math.min(t, 2 * Math.PI - t);
		};
		const dirs = [...DIRS8].sort((a, b) => off(a) - off(b));
		for (let h = 0; h < q.length; h++) {
			const i = q[h];
			if (i === goal) break;
			const x = i % w;
			const y = (i - x) / w;
			for (const d of dirs) {
				const n = step({ x, y }, d);
				if (!isFloor(l, n.x, n.y)) continue;
				const ni = n.y * w + n.x;
				if (prev[ni] !== -2 || !f.seen[ni]) continue;
				if (!run.cornerOk({ x, y }, d)) continue;
				if (traps.has(ni) && ni !== goal) continue;
				// 行き先の 敵（離れた敵を タップした）は 通れる ことにする。となりに 来たら 止まる
				const m = run.monsterAt(n.x, n.y);
				if (m && run.monsterVisible(m) && ni !== goal) continue;
				prev[ni] = i;
				q.push(ni);
			}
		}
		if (prev[goal] === -2) return null;
		let cur = goal;
		while (prev[cur] !== start && prev[cur] >= 0) cur = prev[cur];
		const x = cur % w;
		const y = (cur - x) / w;
		return dirOf(x - run.p.x, y - run.p.y);
	}
}

/** 道のり keys の、時刻 t の位置。 */
const posAt = (keys: Disp["keys"], t: number): Pos => {
	const a = keys[0];
	if (keys.length === 1 || t <= a.t) return { x: a.x, y: a.y };
	for (let i = 1; i < keys.length; i++) {
		const b = keys[i];
		if (t < b.t) {
			const p0 = keys[i - 1];
			const u = (t - p0.t) / (b.t - p0.t);
			return { x: p0.x + (b.x - p0.x) * u, y: p0.y + (b.y - p0.y) * u };
		}
	}
	const z = keys[keys.length - 1];
	return { x: z.x, y: z.y };
};

/** リプレイを見ているときの 再生の様子。 */
type ReplayDriver = {
	replay: SavedReplay;
	steps: ReplayStep[];
	/** 次に入れる こま。 */
	i: number;
	/** 入れたコマンドの数。 */
	done: number;
	total: number;
	paused: boolean;
	/** 速さ（1・2・4・8 倍）。 */
	speed: number;
	/** 次のコマンドを入れてよい時刻。 */
	nextAt: number;
	bar: HTMLElement | null;
	/** 今の版では同じにならなかった（指紋が合わない）。 */
	drift: boolean;
	/** 「次の階へ」を押された（再生中の1手が終わったら とばす）。 */
	skip: boolean;
};

/** コマンドとコマンドの間（ms。1倍のとき）。 */
const REPLAY_GAP = 160;

/** 食べる・飲む・読む演出。 */
type UseFx = {
	icon: string;
	style: "eat" | "drink" | "read";
	t0: number;
	dur: number;
};

/** 道具の区分ごとの演出（ほかの区分は演出なし）。 */
const USE_STYLE: Record<string, UseFx["style"] | undefined> = {
	food: "eat",
	herb: "drink",
	scroll: "read",
};

const USE_MS: Record<UseFx["style"], number> = {
	eat: 900,
	drink: 650,
	read: 650,
};

/** 演出の途中の、頭の上の道具の形。 */
const overheadPose = (u: UseFx, t: number) => {
	const k = Math.max(0, Math.min(1, (t - u.t0) / u.dur));
	// 出るときは ぽんと大きくなり、終わりぎわに消える
	const pop = Math.min(1, 0.4 + k * 6);
	const alpha = k > 0.82 ? 1 - (k - 0.82) / 0.18 : 1;
	switch (u.style) {
		case "eat": {
			// 3口。口ごとに はねて、ひと口ぶん小さくなる
			const bite = Math.min(2, Math.floor(k * 3));
			const ph = (k * 3) % 1;
			return {
				icon: u.icon,
				dy: Math.abs(Math.sin(ph * Math.PI)) * 3,
				scale: pop * (1 - bite * 0.2),
				angle: 0,
				alpha,
			};
		}
		case "drink": {
			// 持ち上げて、口もとへ傾ける
			const lift = Math.sin(Math.min(1, k * 1.8) * (Math.PI / 2));
			return {
				icon: u.icon,
				dy: lift * 4,
				scale: pop,
				angle: -lift * 0.7,
				alpha,
			};
		}
		case "read":
			// ふわっと浮かんで 消える
			return { icon: u.icon, dy: k * 6, scale: pop, angle: 0, alpha };
	}
};

/** 墓が落ちてくる時間（7割で着地して、残りで少しはねる）。 */
const GRAVE_DROP_MS = 600;

/** ms たつか、after ms より後に 画面に触れる・キーを押すまで待つ。 */
const waitOrSkip = (ms: number, after: number): Promise<void> =>
	new Promise((resolve) => {
		let done = false;
		const finish = () => {
			if (done) return;
			done = true;
			clearTimeout(tid);
			window.removeEventListener("pointerdown", finish, true);
			window.removeEventListener("keydown", finish, true);
			resolve();
		};
		const tid = setTimeout(finish, ms);
		setTimeout(() => {
			if (done) return;
			window.addEventListener("pointerdown", finish, true);
			window.addEventListener("keydown", finish, true);
		}, after);
	});

/** 1コマ（60fps）の長さ。 */
const FRAME_MS = 17;

const wait = (ms: number): Promise<void> =>
	new Promise((r) => setTimeout(r, Math.max(0, ms)));

const nextFrameP = (): Promise<void> =>
	new Promise((r) => requestAnimationFrame(() => r()));

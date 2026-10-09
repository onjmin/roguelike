// 実況の エンジン（純粋。DOM・保存・Math.random・data/ の import は なし）。
// 本館の ナイター実況（野球）と、あとで 足す 台本の 番組（映画館の 金曜ロード保守・劇場の 紅白・議会中継）が
// 同じ「スレの 経済」を 使う：予算・書きこみの 波・コンボ・998 で 止める・1000 と 次スレ・勢い・行の 書き手。
//
// - 時間割（JkTimeline）は 番組ごとの 組み立て役が 作る（野球は data/jikkyo/yakyu.ts の yakyuTimeline）。
//   この ファイルは 文も 球団も 知らない（引数で もらう）。
// - 名目の 時計（t）と 実際の 時計（wall）を 両方 持つ。予算・時間割は 名目、勢い・答えの 速さ・表示は 実際。
// - 乱数は jkStart の opt.rand だけ（UI は Math.random、試験は 種つき）。冒険の 乱数・記録・リプレイには 触らない。
// - 窓は 2つの 形を 持つ 予定：blocking（区切りが 窓。早じまいで 残りの 予算を どっと 流す。野球）と
//   overlay（時計を 止めない。番組）。いまは blocking・練習・見るだけ・書き手・1000 の 流れ（切れ目 0）・勢い・結果 だけ 動く。
//   overlay・Cue・950 の 当番・切れ目・timeoutFit・interactive:false・pin・stall は 型だけ 置き、使えば jkStart が 投げる
//   （それを 使う 番組の 手順で 試験と いっしょに 入れる）。
//
// 点の 式（どの 番組も 同じ。定数は 番組ごと）：
//   G = goal × 1000、区切りの 予算 = idle·G·w ÷ Σw、
//   コンボの 倍率 = 1 + boost·min(1, combo ÷ max(comboMin, ⌈comboDen·P⌉))、
//   1回の 書きこみの 波 = post·G ÷ P × weight × fit × speed（練習は practice × fit × speed で P に 数えない）。
//   見るだけなら 1 + idle·G（野球は 601）で、試合の 長さ・見せ場の 数・答える 速さに よらない。

/** 合い。◎ ○ ×。 */
export type JkFit = "best" | "ok" | "miss";
/** [0,1) の 乱数。 */
export type JkRand = () => number;
/** 話し手の 鍵（"me"・"nanashi"・"sys"・"fan:tora" など）。見た目（札の 字・色）は 番組が 決める。 */
export type JkWho = string;

export type JkOpt = { readonly text: string; readonly fit: JkFit };

/** 行の 頼み。pool から 書き手が 引く（fill で {nick}・{team}・{n} を 埋める）。text は 決め打ち。 */
export type JkReq = {
	readonly who: JkWho;
	readonly pool?: string;
	readonly text?: string;
	readonly fill?: Readonly<Record<string, string>>;
};

/** 窓が 閉じた あとの 返し。 */
export type JkAfter = {
	/** キリコの レスへの アンカー返信（>>{n}）。fit ごとの pool と 数の はば。 */
	readonly replies?: Readonly<
		Record<
			JkFit,
			{ readonly pool: string; readonly n: readonly [number, number] }
		>
	>;
	/**
	 * ◎ の 文を なぞる 名無し（スレが 正解を 教える）。見送りでも 出す。はじめの 1行は 窓の ◎ の 文
	 * （直近に 出ていれば alt から）、2行目からは alt（その 窓の ほかの ◎）から 引く。
	 */
	readonly echo?: {
		readonly who: JkWho;
		readonly n: readonly [number, number];
		readonly alt?: readonly string[];
	};
	/** 当てた／外した あとの 群衆（pool）。 */
	readonly cheer?: string;
	readonly boo?: string;
};

export type JkPick = {
	readonly type: "pick";
	readonly id: string;
	/** 2〜3 */
	readonly opts: readonly JkOpt[];
	/** 受付（既定 4000）。 */
	readonly open: number;
	/** P に 数える 重み（練習・当番は 0）。 */
	readonly weight: number;
	/** 練習の 点（野球の スレ立て＝10）。ある ときは P に 数えない。 */
	readonly practice?: number;
	/** 答えない ときの 判定（紅白の 鐘。まだ 使えない）。 */
	readonly timeoutFit?: JkFit;
	readonly after?: JkAfter;
	/** 窓の あいだに すぐ 出す 反応（2行まで）。 */
	readonly quick?: readonly JkReq[];
	/** 閉じてから 出す その 出来事への 行（因果の 順）。 */
	readonly held?: readonly JkReq[];
	/** 番組の 中身（野球の kinds・top・主語）。エンジンは 読まない。 */
	readonly meta?: unknown;
};

export type JkCueGrade = "kami" | "oshii" | "flying" | "late" | "none";

/** 山場の 1語（バルス／あけおめ。まだ 使えない）。 */
export type JkCue = {
	readonly type: "cue";
	readonly id: string;
	readonly word: string;
	readonly beat: number;
	readonly pulses: number;
	readonly weight: number;
	readonly flood: string;
	readonly names?: Readonly<Record<JkCueGrade, string>>;
};
export type JkWin = JkPick | JkCue;

/** 目立つ 書きこみ（速記ニキ・システム・議長。まだ 使えない）。at は 区切りの 頭から。 */
export type JkPost = {
	readonly at: number;
	readonly who: JkWho;
	readonly text: string;
	readonly pin?: number;
};

export type JkSeg = {
	/** 名目の ms。 */
	readonly start: number;
	readonly dur: number;
	/** 群衆の 重み（予算の 割り当て）。 */
	readonly w: number;
	/** blocking の 窓（この 区切りが 窓 open＋reveal）。 */
	readonly win?: JkPick;
	/** 区切りの 頭で 列に 入れる 行（窓の ない 出来事への 反応）。 */
	readonly react?: readonly JkReq[];
	/** 列が 空の ときの ふだんの 流れ（p は 重み）。 */
	readonly filler?: readonly {
		readonly who: JkWho;
		readonly pool: string;
		readonly p: number;
	}[];
	readonly posts?: readonly JkPost[];
	readonly scene?: string;
	readonly caption?: string;
	readonly bgm?: string | null;
	readonly title?: { readonly now?: string; readonly next?: string };
	readonly stall?: number;
	readonly heat?: number;
	/** TV の ための 中身（野球の 打席）。 */
	readonly data?: unknown;
};

export type JkTimeline = {
	readonly segs: readonly JkSeg[];
	/** 時計を 止めない 窓（まだ 使えない）。 */
	readonly overlays: readonly { readonly at: number; readonly win: JkWin }[];
	/** 名目の 長さ。 */
	readonly total: number;
	/** Σ weight（練習を のぞく）。 */
	readonly P: number;
};

export type JkRoll = {
	readonly at1000: (v: JkView) => {
		readonly who: JkWho;
		readonly text: string;
	};
	/** 新しい スレタイ（22字まで）。 */
	readonly title: (part: number) => string;
	/** ヘッダーの 左『Part12』。 */
	readonly label: (part: number) => string;
	/** 名無しの『次スレ→　Part13』。 */
	readonly next?: (part: number) => string;
	/** 『前スレ999、わかっとるな』 */
	readonly took999?: string;
	/** 新スレの 頭の 波（番組だけ。pool）。 */
	readonly open?: string;
	/** 切れ目（番組だけ。野球は ぜんぶ 0）。 */
	readonly gap: Readonly<Record<JkFit | "none", number>>;
	readonly gapPool?: string;
	/** 1000 の 小さな 山場の 長さ（野球 2500）。 */
	readonly flow: number;
};

export type JkDuty = {
	readonly first: readonly JkOpt[];
	readonly variants: readonly {
		readonly pin: string;
		readonly opts: readonly JkOpt[];
	}[];
	readonly max: number;
	readonly toPick: number;
	readonly toCue: number;
	readonly auto: number;
};

export type JkRules = {
	/** スレの 数。G = goal×1000。 */
	readonly goal: number;
	readonly idle: number;
	readonly post: number;
	readonly boost: number;
	readonly comboMin: number;
	readonly comboDen: number;
	readonly fit: Readonly<Record<JkFit, number>>;
	/** [[1000,1],[2000,.85],[4000,.7]]（それより 遅いと 最後の 値）。 */
	readonly speed: readonly (readonly [number, number])[];
	/** 答え合わせ（ms）。 */
	readonly reveal: number;
	/** 書きこみの 波を 流す ms。 */
	readonly wave: number;
	/** 見るだけで 窓の かわりに 置く 間。 */
	readonly watchHold: number;
	readonly windowMode: "blocking" | "overlay";
	/** false＝窓を 出さない（議会中継。まだ 使えない）。 */
	readonly interactive: boolean;
	/** ここで ふつうの 行を 止める（998）。 */
	readonly hold: number;
	readonly roll: JkRoll;
	readonly duty?: JkDuty;
	readonly display: {
		readonly perRes: number;
		readonly min: number;
		readonly max: number;
		readonly burst: number;
		readonly burstReduced: number;
	};
	readonly writer: {
		/** 直近 N 行の 文は 出さない。 */
		readonly recent: number;
		/** 話し手の 種類（':' の 前）→ 1回の 上映で 同じ 文を 出す 上限。 */
		readonly caps: Readonly<Record<string, number>>;
		/** 重ねて よい pool（洪水）。 */
		readonly repeatOk: readonly string[];
	};
	/** 『もう一度　Bで　やめる』 */
	readonly quitNote: string;
};

export type JkPools = Readonly<Record<string, readonly string[]>>;

export type JkOptions = {
	readonly rand: JkRand;
	/** 見るだけ（窓を 出さない。B 1回で 閉じる）。 */
	readonly watch?: boolean;
	/** false なら 練習の 窓に 時計なし（はじめての 1回）。 */
	readonly tutored?: boolean;
	/** 動きを へらす（表示の 上限 burstReduced 行/秒）。 */
	readonly reduced?: boolean;
	/** はじめの スレ番。 */
	readonly part?: number;
};

export type JkInput =
	| { readonly pick: number; readonly ago: number }
	| { readonly press: true; readonly ago: number }
	| { readonly quit: true };

export type JkLine = {
	/** レス番（スレの 中の 番号。null は 番号なし）。 */
	readonly no: number | null;
	readonly part: number;
	readonly who: JkWho;
	readonly text: string;
	readonly cls?: "me" | "anc" | "sys" | "over" | "title" | "pin";
};

export type JkEv =
	| { readonly t: "line"; readonly line: JkLine }
	| { readonly t: "pin"; readonly line: JkLine; readonly ms: number }
	| { readonly t: "open"; readonly win: JkWin; readonly untimed: boolean }
	| {
			readonly t: "reveal";
			readonly chosen: number | null;
			readonly fit: JkFit | null;
			readonly gain: number;
			readonly fast: boolean;
	  }
	| { readonly t: "close" }
	| { readonly t: "pulse"; readonly i: number }
	| { readonly t: "grade"; readonly grade: JkCueGrade }
	| { readonly t: "scene"; readonly seg: JkSeg; readonly i: number }
	| { readonly t: "roll"; readonly part: number; readonly title: string }
	| { readonly t: "retitle"; readonly title: string }
	| { readonly t: "gap"; readonly on: boolean }
	| { readonly t: "flood"; readonly on: boolean }
	| { readonly t: "kanso" }
	| { readonly t: "note"; readonly text: string }
	| { readonly t: "combo"; readonly combo: number }
	| { readonly t: "end"; readonly result: JkResult | null };

export type JkView = {
	/** いままでの レスの 合計（スレを またいで 数える）。 */
	readonly res: number;
	readonly part: number;
	/** いまの スレの レス番（ヘッダーの『レス　742／1000』）。 */
	readonly no: number;
	readonly label: string;
	readonly ikioi: number;
	readonly ikioiMax: number;
	readonly combo: number;
	readonly win: {
		readonly left: number;
		readonly open: number;
		readonly untimed: boolean;
		readonly reveal: boolean;
	} | null;
	/** いまの 区切り（野球の at1000 は seg.data の 点差を 読む）。 */
	readonly seg: JkSeg | null;
	readonly t: number;
	readonly total: number;
	readonly ended: boolean;
	/** 直近 2秒の レス／秒（進み具合の バーの 見こみ）。 */
	readonly pace: number;
};

export type JkResult = {
	readonly res: number;
	readonly part0: number;
	readonly part: number;
	/** res ≥ G */
	readonly kanso: boolean;
	readonly comboMax: number;
	readonly ikioiMax: number;
	/** 練習を のぞく 窓の 答え。 */
	readonly counts: Readonly<Record<JkFit | "none", number>>;
	readonly cue: JkCueGrade | null;
	readonly watch: boolean;
};

// ───────────────── 道具 ─────────────────

/** 答えの 速さの 重み（窓が 開いてから ms）。 */
export const speedOf = (rules: JkRules, ms: number): number => {
	for (const [lim, w] of rules.speed) if (ms <= lim) return w;
	return rules.speed[rules.speed.length - 1]?.[1] ?? 1;
};

/**
 * 熱の 曲線から 区切りごとの 群衆の 重み：w(t) = 1 + gain·heat(t) を step ms ごとに 足す
 * （heat は 区切りの 頭で 足し、半減期 half で へる）。
 */
export const heatWeights = (
	segs: readonly { start: number; dur: number; heat: number }[],
	gain: number,
	half: number,
	step = 100,
): number[] => {
	const w = new Array<number>(segs.length).fill(0);
	const end = segs.length
		? segs[segs.length - 1].start + segs[segs.length - 1].dur
		: 0;
	let heat = 0;
	let si = 0;
	const decay = 0.5 ** (step / half);
	for (let x = 0; x < end; x += step) {
		while (si < segs.length && segs[si].start <= x) {
			heat += segs[si].heat;
			si++;
		}
		w[Math.max(0, si - 1)] += 1 + gain * heat;
		heat *= decay;
	}
	return w;
};

/** {key} を 埋める（埋まらない ものは そのまま 残す。試験で 落とす）。 */
export const fillText = (
	s: string,
	v: Readonly<Record<string, string>> | undefined,
): string => (v ? s.replace(/\{(\w+)\}/g, (m, k: string) => v[k] ?? m) : s);

// ───────────────── 書き手 ─────────────────

/** 行の 文を 選ぶ 小さな 部品（袋・直近・上限）。 */
export type JkWriter = {
	readonly pools: JkPools;
	readonly recentN: number;
	readonly caps: Readonly<Record<string, number>>;
	readonly repeatOk: ReadonlySet<string>;
	readonly bags: Map<string, string[]>;
	readonly recent: string[];
	readonly counts: Map<string, number>;
};

export const makeWriter = (pools: JkPools, rules: JkRules): JkWriter => ({
	pools,
	recentN: rules.writer.recent,
	caps: rules.writer.caps,
	repeatOk: new Set(rules.writer.repeatOk),
	bags: new Map(),
	recent: [],
	counts: new Map(),
});

const typeOf = (who: JkWho): string => who.split(":")[0];

const shuffled = (list: readonly string[], rand: JkRand): string[] => {
	const a = [...list];
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
};

/** 出した 文を 覚える（直近と 上限）。 */
const noteText = (w: JkWriter, who: JkWho, text: string, pool?: string) => {
	if (pool && w.repeatOk.has(pool)) return;
	w.recent.push(text);
	if (w.recent.length > w.recentN) w.recent.shift();
	const k = `${typeOf(who)}|${text}`;
	w.counts.set(k, (w.counts.get(k) ?? 0) + 1);
};

/** この 文を いま 出せるか（直近・上限・窓の 候補）。 */
const fresh = (
	w: JkWriter,
	who: JkWho,
	text: string,
	banned: ReadonlySet<string>,
	pool?: string,
): boolean => {
	if (banned.has(text)) return false;
	if (pool && w.repeatOk.has(pool)) return true;
	if (w.recent.includes(text)) return false;
	const cap = w.caps[typeOf(who)];
	return (
		cap === undefined || (w.counts.get(`${typeOf(who)}|${text}`) ?? 0) < cap
	);
};

/**
 * 頼みから 文を 1つ 決める（決め打ちの text は そのまま）。pool は 話し手 × pool の 袋から 引き、
 * 直近・上限・banned（開いて いる 窓の 候補）に 当たる 文は とばす。出せる 文が なければ null。
 */
export const pickText = (
	w: JkWriter,
	req: JkReq,
	rand: JkRand,
	banned: ReadonlySet<string>,
): string | null => {
	if (req.text !== undefined) {
		const t = fillText(req.text, req.fill);
		noteText(w, req.who, t);
		return t;
	}
	if (!req.pool) return null;
	const list = w.pools[req.pool];
	if (!list?.length) return null;
	const key = `${req.who}|${req.pool}`;
	const tryBag = (bag: string[]): string | null => {
		for (let k = 0; k < bag.length; k++) {
			const t = fillText(bag[k], req.fill);
			if (!fresh(w, req.who, t, banned, req.pool)) continue;
			bag.splice(k, 1);
			noteText(w, req.who, t, req.pool);
			return t;
		}
		return null;
	};
	let bag = w.bags.get(key);
	if (!bag?.length) {
		bag = shuffled(list, rand);
		w.bags.set(key, bag);
	}
	const got = tryBag(bag);
	if (got !== null) return got;
	// 袋の 残りが ぜんぶ 出せない → 入れなおして もう 1回
	bag = shuffled(list, rand);
	w.bags.set(key, bag);
	return tryBag(bag);
};

// ───────────────── 状態 ─────────────────

type QItem = {
	readonly req: JkReq;
	readonly cls?: JkLine["cls"];
	/** {n} を いまの キリコの レス番で 埋める（アンカー返信）。 */
	readonly anc?: boolean;
	/** 窓の ◎ を なぞる（直近に 出ていれば alt から）。 */
	readonly echo?: {
		readonly first: string | null;
		readonly alt: readonly string[];
	};
};

type WinSt = {
	readonly seg: number;
	readonly pick: JkPick;
	phase: "open" | "reveal";
	/** 開いてから（実際の ms）。 */
	elapsed: number;
	readonly untimed: boolean;
	revealLeft: number;
	/** 答え合わせに 入った ときの 区切りの 名目の 進み。 */
	t0: number;
	readonly banned: ReadonlySet<string>;
};

type Wave = { perMs: number; left: number };

type FlowStep = { readonly at: number; readonly run: (evs: JkEv[]) => void };
/** 1000 の 流れ（el は 流れの 中の 時刻。blocking の 窓が 開いて いる あいだは 進めない）。 */
type FlowSt = { el: number; readonly steps: FlowStep[] };

export type JkSt = {
	readonly tl: JkTimeline;
	readonly rules: JkRules;
	readonly opt: JkOptions;
	readonly rand: JkRand;
	readonly G: number;
	readonly budgets: readonly number[];
	/** 区切り i から 見て 次に 窓の ある 区切り（無ければ -1）。 */
	readonly nextWin: readonly number[];
	readonly writer: JkWriter;
	t: number;
	wall: number;
	i: number;
	segT: number;
	spent: number;
	res: number;
	readonly part0: number;
	part: number;
	lastNo: number;
	has999: boolean;
	me999: boolean;
	meNo: number;
	combo: number;
	comboMax: number;
	counts: Record<JkFit | "none", number>;
	win: WinSt | null;
	waves: Wave[];
	q: QItem[];
	quick: QItem[];
	deferredMe: string[];
	lastLineAt: number;
	burstUntil: number;
	bins: Float64Array;
	binAt: number;
	binSum: number;
	ikioiMax: number;
	flow: FlowSt | null;
	kansoSent: boolean;
	quitAt: number;
	started: boolean;
	ended: boolean;
	result: JkResult | null;
};

const BIN_MS = 100;
const BINS = 100; // 10秒
const PACE_BINS = 20; // 2秒
const QUIT_MS = 1500;
const BURST_MS = 2000;

/** まだ 入れていない 機能を 使う 時間割・決まりを はじく（使う 番組の 手順で 入れる）。 */
const guard = (tl: JkTimeline, rules: JkRules): void => {
	const no = (why: string) => {
		throw new Error(`jikkyo: ${why} is not supported yet`);
	};
	if (tl.overlays.length) no("overlay windows");
	if (rules.windowMode !== "blocking") no("overlay mode");
	if (!rules.interactive) no("interactive:false");
	if (rules.duty) no("the 950 duty");
	if (Object.values(rules.roll.gap).some((g) => g > 0)) no("thread gaps");
	for (const s of tl.segs) {
		if (s.posts?.length) no("posts");
		if (s.stall) no("stall");
		if (s.title) no("retitle");
		if (s.win?.timeoutFit) no("timeoutFit");
	}
};

const nextWins = (tl: JkTimeline): number[] => {
	const out = new Array<number>(tl.segs.length + 1).fill(-1);
	for (let i = tl.segs.length - 1; i >= 0; i--)
		out[i] = tl.segs[i].win ? i : out[i + 1];
	return out;
};

export const jkStart = (
	tl: JkTimeline,
	rules: JkRules,
	pools: JkPools,
	opt: JkOptions,
): JkSt => {
	guard(tl, rules);
	const G = rules.goal * 1000;
	const sumW = tl.segs.reduce((s, x) => s + x.w, 0) || 1;
	const part = opt.part ?? 1;
	return {
		tl,
		rules,
		opt,
		rand: opt.rand,
		G,
		budgets: tl.segs.map((s) => (rules.idle * G * s.w) / sumW),
		nextWin: nextWins(tl),
		writer: makeWriter(pools, rules),
		t: 0,
		wall: 0,
		i: 0,
		segT: 0,
		spent: 0,
		res: 1,
		part0: part,
		part,
		lastNo: 1,
		has999: false,
		me999: false,
		meNo: 0,
		combo: 0,
		comboMax: 0,
		counts: { best: 0, ok: 0, miss: 0, none: 0 },
		win: null,
		waves: [],
		q: [],
		quick: [],
		deferredMe: [],
		lastLineAt: -1e9,
		burstUntil: -1,
		bins: new Float64Array(BINS),
		binAt: 0,
		binSum: 0,
		ikioiMax: 0,
		flow: null,
		kansoSent: false,
		quitAt: -1e9,
		started: false,
		ended: false,
		result: null,
	};
};

// ───────────────── 数・勢い ─────────────────

const multOf = (st: JkSt): number => {
	const r = st.rules;
	const den = Math.max(r.comboMin, Math.ceil(r.comboDen * st.tl.P));
	return 1 + r.boost * Math.min(1, den > 0 ? st.combo / den : 0);
};

const addRes = (st: JkSt, x: number): void => {
	if (x <= 0) return;
	st.res += x;
	st.bins[st.binAt % BINS] += x;
	st.binSum += x;
};

/** 実際の 時計を 進めて 勢いの 箱を まわす。 */
const rotateBins = (st: JkSt): void => {
	const at = Math.floor(st.wall / BIN_MS);
	if (at - st.binAt >= BINS) {
		st.bins.fill(0);
		st.binSum = 0;
		st.binAt = at;
		return;
	}
	while (st.binAt < at) {
		st.binAt++;
		const k = st.binAt % BINS;
		st.binSum -= st.bins[k];
		st.bins[k] = 0;
	}
	if (st.binSum < 1e-9) st.binSum = 0;
};

/** 勢い（直近 10秒の レス ÷ 10 × 86400）。 */
const ikioiOf = (st: JkSt): number => Math.round((st.binSum / 10) * 86400);

/** 直近 2秒の レス／秒。 */
const paceOf = (st: JkSt): number => {
	let s = 0;
	for (let k = 0; k < PACE_BINS; k++)
		s += st.bins[(st.binAt - k + BINS * 4) % BINS];
	return s / (PACE_BINS / 10);
};

/** いまの スレの レス番（生きている カウンタ）。 */
const threadNo = (st: JkSt): number =>
	Math.floor(st.res + 1e-9) - 1000 * (st.part - st.part0);

// ───────────────── 区切り ─────────────────

const enterSeg = (st: JkSt, i: number, evs: JkEv[]): void => {
	st.i = i;
	st.segT = 0;
	st.spent = 0;
	const seg = st.tl.segs[i];
	if (!seg) return;
	evs.push({ t: "scene", seg, i });
	for (const r of seg.react ?? []) st.q.push({ req: r });
	if (seg.win && !st.opt.watch) {
		const untimed = seg.win.practice !== undefined && st.opt.tutored === false;
		st.win = {
			seg: i,
			pick: seg.win,
			phase: "open",
			elapsed: 0,
			untimed,
			revealLeft: 0,
			t0: 0,
			banned: new Set(seg.win.opts.map((o) => o.text)),
		};
		st.quick = (seg.win.quick ?? []).slice(0, 2).map((req) => ({ req }));
		evs.push({ t: "open", win: seg.win, untimed });
	}
};

const spend = (st: JkSt, amount: number): void => {
	const budget = st.budgets[st.i] ?? 0;
	const a = Math.max(0, Math.min(amount, budget - st.spent));
	st.spent += a;
	addRes(st, a * multOf(st));
};

const wave = (st: JkSt, amount: number, ms: number): void => {
	if (amount <= 0) return;
	if (ms <= 0) {
		addRes(st, amount);
		return;
	}
	st.waves.push({ perMs: amount / ms, left: ms });
};

const runWaves = (st: JkSt, dt: number): void => {
	if (!st.waves.length) return;
	for (const w of st.waves) {
		const d = Math.min(dt, w.left);
		addRes(st, w.perMs * d);
		w.left -= d;
	}
	st.waves = st.waves.filter((w) => w.left > 1e-9);
};

/** 区切りの 予算の 残りを（いまの 倍率で）答え合わせの あいだに 流す。 */
const flushRest = (st: JkSt, extra: number): void => {
	const budget = st.budgets[st.i] ?? 0;
	const left = Math.max(0, budget - st.spent);
	st.spent = budget;
	wave(st, left * multOf(st) + extra, st.rules.reveal);
};

const closeSeq = (st: JkSt, pick: JkPick, fit: JkFit | null): QItem[] => {
	const seq: QItem[] = [];
	const r = st.rand;
	const between = ([a, b]: readonly [number, number]) =>
		a + Math.floor(r() * (b - a + 1));
	const rep = fit ? pick.after?.replies?.[fit] : undefined;
	if (rep)
		for (let k = between(rep.n); k > 0; k--)
			seq.push({
				req: { who: "nanashi", pool: rep.pool },
				anc: true,
				cls: "anc",
			});
	for (const h of pick.held ?? []) seq.push({ req: h });
	const echo = pick.after?.echo;
	if (echo) {
		const best = pick.opts.find((o) => o.fit === "best")?.text ?? null;
		const alt = echo.alt ?? [];
		for (let k = between(echo.n); k > 0; k--)
			seq.push({
				req: { who: echo.who },
				echo: { first: seq.some((x) => x.echo) ? null : best, alt },
			});
	}
	const crowd =
		fit === "best" || fit === "ok" ? pick.after?.cheer : pick.after?.boo;
	if (crowd) seq.push({ req: { who: "nanashi", pool: crowd } });
	return seq;
};

/** キリコの レス（すぐ 出す）。999 まで。999 が もう ある スレでは 次の スレの >>1 の あとに 回す。 */
const postMine = (st: JkSt, text: string, evs: JkEv[]): void => {
	const no = threadNo(st);
	if (st.has999 && no >= st.rules.hold + 1) {
		st.deferredMe.push(text);
		return;
	}
	let n = Math.max(st.lastNo + 1, Math.min(no, st.rules.hold + 1));
	if (n >= st.rules.hold + 1) {
		n = st.rules.hold + 1;
		st.has999 = true;
		st.me999 = true;
	}
	st.lastNo = n;
	st.meNo = n;
	noteText(st.writer, "me", text);
	evs.push({
		t: "line",
		line: { no: n, part: st.part, who: "me", text, cls: "me" },
	});
};

const answer = (st: JkSt, i: number, ago: number, evs: JkEv[]): void => {
	const w = st.win;
	if (w?.phase !== "open") return;
	const opt = w.pick.opts[i];
	if (!opt) return;
	const r = st.rules;
	const ms = Math.max(0, w.elapsed - Math.max(0, ago));
	const sp = w.untimed ? 1 : speedOf(r, ms);
	const fw = r.fit[opt.fit];
	const practice = w.pick.practice !== undefined;
	const gain = practice
		? Math.round((w.pick.practice ?? 0) * fw * sp)
		: st.tl.P > 0
			? Math.round(((r.post * st.G) / st.tl.P) * w.pick.weight * fw * sp)
			: 0;
	st.combo = opt.fit === "miss" ? 0 : st.combo + 1;
	st.comboMax = Math.max(st.comboMax, st.combo);
	if (!practice) st.counts[opt.fit]++;
	flushRest(st, gain);
	evs.push({
		t: "reveal",
		chosen: i,
		fit: opt.fit,
		gain,
		fast: !w.untimed && ms <= (r.speed[0]?.[0] ?? 0),
	});
	evs.push({ t: "combo", combo: st.combo });
	postMine(st, opt.text, evs);
	st.q.unshift(...closeSeq(st, w.pick, opt.fit));
	w.phase = "reveal";
	w.revealLeft = r.reveal;
	w.t0 = Math.min(w.elapsed, w.pick.open);
	st.quick = [];
	st.burstUntil = st.wall + BURST_MS;
};

const timeout = (st: JkSt, evs: JkEv[]): void => {
	const w = st.win;
	if (w?.phase !== "open") return;
	st.combo = Math.floor(st.combo / 2);
	if (w.pick.practice === undefined) st.counts.none++;
	flushRest(st, 0);
	evs.push({ t: "reveal", chosen: null, fit: null, gain: 0, fast: false });
	evs.push({ t: "combo", combo: st.combo });
	st.q.unshift(...closeSeq(st, w.pick, null));
	w.phase = "reveal";
	w.revealLeft = st.rules.reveal;
	w.t0 = w.pick.open;
	st.quick = [];
	st.burstUntil = st.wall + BURST_MS;
};

/** 名目の 時計を 進める（blocking の 窓では 窓の 区切りの 中で）。 */
const advance = (st: JkSt, dt: number, evs: JkEv[]): void => {
	const segs = st.tl.segs;
	let left = dt;
	let guardN = 0;
	while (left > 1e-9 && st.i < segs.length && guardN++ < 64) {
		const seg = segs[st.i];
		const budget = st.budgets[st.i] ?? 0;
		const w = st.win;
		if (seg.win && w && w.seg === st.i) {
			if (w.phase === "open") {
				const lim = w.untimed ? left : w.pick.open - w.elapsed;
				const d = Math.max(0, Math.min(left, lim));
				const spendable = Math.max(0, Math.min(d, w.pick.open - w.elapsed));
				spend(st, (budget * spendable) / seg.dur);
				w.elapsed += d;
				left -= d;
				st.t = seg.start + Math.min(w.elapsed, w.pick.open);
				if (!w.untimed && w.elapsed >= w.pick.open - 1e-9) timeout(st, evs);
				if (w.untimed) break;
				continue;
			}
			const d = Math.min(left, w.revealLeft);
			w.revealLeft -= d;
			left -= d;
			const rest = seg.dur - w.t0;
			st.t =
				seg.start +
				seg.dur -
				rest * (w.revealLeft / Math.max(1, st.rules.reveal));
			if (w.revealLeft <= 1e-9) {
				st.win = null;
				evs.push({ t: "close" });
				st.t = seg.start + seg.dur;
				enterSeg(st, st.i + 1, evs);
			}
			continue;
		}
		if (seg.win && st.opt.watch) {
			// 見るだけ：窓の かわりに watchHold の 間で その 区切りの 予算を ぜんぶ 使う
			const hold = Math.max(1, st.rules.watchHold);
			const d = Math.min(left, hold - st.segT);
			spend(st, (budget * d) / hold);
			st.segT += d;
			left -= d;
			st.t = seg.start + (seg.dur * st.segT) / hold;
			if (st.segT >= hold - 1e-9) {
				spend(st, budget);
				enterSeg(st, st.i + 1, evs);
			}
			continue;
		}
		const d = Math.min(left, seg.dur - st.segT);
		spend(st, (budget * d) / Math.max(1, seg.dur));
		st.segT += d;
		left -= d;
		st.t = seg.start + st.segT;
		if (st.segT >= seg.dur - 1e-9) {
			spend(st, budget);
			enterSeg(st, st.i + 1, evs);
		}
	}
	if (st.i >= segs.length) st.t = st.tl.total;
};

// ───────────────── 1000 と 次スレ ─────────────────

const viewOf = (st: JkSt): JkView => jkView(st);

/** 1000 の 流れ：999 → 1000 → 1001 → 次スレ→ → （スレを 消して）>>1 → 前スレ999。 */
const startFlow = (st: JkSt): void => {
	const r = st.rules.roll;
	const steps: FlowStep[] = [];
	const at = (ms: number, run: (evs: JkEv[]) => void) =>
		steps.push({ at: ms, run });
	const part = st.part;
	if (!st.has999)
		at(0, (evs) => {
			const text = pickText(
				st.writer,
				{ who: "nanashi", pool: "nanashi" },
				st.rand,
				new Set(),
			);
			st.has999 = true;
			st.lastNo = 999;
			if (text)
				evs.push({ t: "line", line: { no: 999, part, who: "nanashi", text } });
		});
	at(300, (evs) => {
		const g = r.at1000(viewOf(st));
		st.lastNo = 1000;
		noteText(st.writer, g.who, g.text);
		evs.push({ t: "line", line: { no: 1000, part, who: g.who, text: g.text } });
		if (!st.kansoSent && st.res >= st.G - 1e-9) {
			st.kansoSent = true;
			evs.push({ t: "kanso" });
		}
	});
	at(600, (evs) => {
		evs.push({
			t: "line",
			line: { no: 1001, part, who: "sys", text: OVER_TEXT, cls: "over" },
		});
	});
	if (r.next) {
		const next = r.next(part + 1);
		at(900, (evs) => {
			noteText(st.writer, "nanashi", next);
			evs.push({
				t: "line",
				line: { no: null, part, who: "nanashi", text: next },
			});
		});
	}
	at(1300, (evs) => {
		const took = st.me999;
		st.part = part + 1;
		st.lastNo = 1;
		st.has999 = false;
		st.me999 = false;
		const title = r.title(st.part);
		evs.push({ t: "roll", part: st.part, title });
		evs.push({
			t: "line",
			line: { no: 1, part: st.part, who: "nanashi", text: title, cls: "title" },
		});
		if (took && r.took999) {
			const text = r.took999;
			at(1700, (e2) => {
				st.lastNo = Math.max(st.lastNo + 1, threadNo(st));
				noteText(st.writer, "nanashi", text);
				e2.push({
					t: "line",
					line: { no: st.lastNo, part: st.part, who: "nanashi", text },
				});
			});
		}
		at(1900, (e2) => {
			for (const text of st.deferredMe.splice(0)) postMine(st, text, e2);
		});
	});
	st.flow = { el: 0, steps };
};

/** このスレッドは　1000を　超えました。 */
export const OVER_TEXT = "このスレッドは　1000を　超えました。";

const runFlow = (st: JkSt, evs: JkEv[], dt: number): void => {
	const f = st.flow;
	if (!f) return;
	// 流れの とちゅうで 次の 窓が 開いたら、閉じるまで 待つ（1000 の 行は 窓の あいだに 出さない）
	if (!st.win) f.el += dt;
	const el = f.el;
	// 走らせた 歩の 中で 歩が 足される ことが あるので、毎回 先頭から 見る
	for (;;) {
		f.steps.sort((a, b) => a.at - b.at);
		const k = f.steps.findIndex((s) => s.at <= el);
		if (k < 0) break;
		const [s] = f.steps.splice(k, 1);
		s.run(evs);
	}
	if (el >= st.rules.roll.flow && !f.steps.length) st.flow = null;
};

const checkRoll = (st: JkSt): void => {
	if (st.flow || st.ended) return;
	if (st.win) return; // blocking の 窓が 閉じるまで 待つ
	if (Math.floor(st.res + 1e-9) >= 1000 * (st.part - st.part0 + 1))
		startFlow(st);
};

// ───────────────── 行を 出す ─────────────────

const rateOf = (st: JkSt): number => {
	const d = st.rules.display;
	let r = Math.max(d.min, Math.min(d.max, d.perRes * paceOf(st)));
	if (st.wall < st.burstUntil) r = Math.max(r, d.burst);
	if (st.opt.reduced) r = Math.min(r, d.burstReduced);
	return r;
};

const fillerReq = (st: JkSt): JkReq | null => {
	const seg = st.tl.segs[Math.min(st.i, st.tl.segs.length - 1)];
	const f = seg?.filler;
	if (!f?.length) return null;
	const sum = f.reduce((s, x) => s + x.p, 0);
	let x = st.rand() * sum;
	for (const e of f) {
		x -= e.p;
		if (x < 0) return { who: e.who, pool: e.pool };
	}
	const e = f[f.length - 1];
	return { who: e.who, pool: e.pool };
};

const resolve = (
	st: JkSt,
	item: QItem,
	banned: ReadonlySet<string>,
): string | null => {
	if (item.echo) {
		const w = st.writer;
		const tries = [
			...(item.echo.first ? [item.echo.first] : []),
			...shuffled(item.echo.alt, st.rand),
		];
		for (const t of tries)
			if (fresh(w, item.req.who, t, banned)) {
				noteText(w, item.req.who, t);
				return t;
			}
		return null;
	}
	const req = item.anc
		? { ...item.req, fill: { ...item.req.fill, n: String(st.meNo) } }
		: item.req;
	return pickText(st.writer, req, st.rand, banned);
};

const emitLines = (st: JkSt, evs: JkEv[]): void => {
	if (st.flow) return;
	const interval = 1000 / rateOf(st);
	if (st.wall - st.lastLineAt < interval - 1e-6) return;
	const blockingOpen = st.win?.phase === "open";
	const no = threadNo(st);
	if (no <= st.lastNo || no > st.rules.hold) return;
	let item: QItem | undefined;
	if (blockingOpen) {
		item = st.quick.shift();
		if (!item) return;
	} else {
		item = st.q.shift();
		if (!item) {
			const req = fillerReq(st);
			if (!req) return;
			item = { req };
		}
	}
	st.lastLineAt = st.wall;
	const banned = bannedNow(st);
	const text = resolve(st, item, banned);
	if (text === null) return;
	st.lastNo = no;
	evs.push({
		t: "line",
		line: { no, part: st.part, who: item.req.who, text, cls: item.cls },
	});
};

const EMPTY_SET: ReadonlySet<string> = new Set();

/** 窓が 開く この 名目の ms 前から、その 窓の 候補の 文を 群衆に 書かせない（キリコの 書きこみと 重ならない ように）。 */
const LOOKAHEAD_MS = 15000;

/** いま 群衆に 書かせない 文（開いて いる 窓と、もうすぐ 開く 窓の 候補）。 */
const bannedNow = (st: JkSt): ReadonlySet<string> => {
	const w = st.win;
	const cur = w && w.phase === "open" ? w.banned : null;
	const k =
		st.nextWin[Math.min(st.i + (w ? 1 : 0), st.nextWin.length - 1)] ?? -1;
	const next = k >= 0 ? st.tl.segs[k] : undefined;
	if (!next?.win || next.start - st.t > LOOKAHEAD_MS) return cur ?? EMPTY_SET;
	const out = new Set(cur ?? []);
	for (const o of next.win.opts) out.add(o.text);
	return out;
};

// ───────────────── 終わり ─────────────────

const finish = (st: JkSt, evs: JkEv[], result: JkResult | null): void => {
	st.ended = true;
	st.win = null;
	st.result = result;
	evs.push({ t: "end", result });
};

const resultOf = (st: JkSt): JkResult => ({
	res: Math.floor(st.res + 1e-9),
	part0: st.part0,
	part: st.part,
	kanso: st.res >= st.G - 1e-9,
	comboMax: st.comboMax,
	ikioiMax: st.ikioiMax,
	counts: { ...st.counts },
	cue: null,
	watch: !!st.opt.watch,
});

const checkEnd = (st: JkSt, evs: JkEv[]): void => {
	if (st.i < st.tl.segs.length || st.flow || st.win || st.waves.length) return;
	// 998〜999 で 止まった：止めていた 行を 出して、いまの 番号（999 まで）で 終わる（1000 の 流れは なし）
	const no = Math.min(threadNo(st), st.rules.hold + 1);
	if (
		no >= st.rules.hold &&
		no > st.lastNo &&
		!(no > st.rules.hold && st.has999)
	) {
		const filler = fillerReq(st);
		const reqs = [
			...st.q.map((x) => x.req),
			...(filler ? [filler] : []),
			{ who: "nanashi", pool: "nanashi" },
		];
		for (const req of reqs) {
			const text = pickText(st.writer, req, st.rand, EMPTY_SET);
			if (text === null) continue;
			if (no > st.rules.hold) st.has999 = true;
			st.lastNo = no;
			evs.push({ t: "line", line: { no, part: st.part, who: req.who, text } });
			break;
		}
	}
	finish(st, evs, resultOf(st));
};

// ───────────────── 1歩 ─────────────────

/**
 * 1歩 進める（dt は 実際の ms。UI は 100 で 頭打ちに して わたす）。input は その 歩の はじめに 1つ。
 * 返す イベントは 起きた 順。
 */
export const jkStep = (st: JkSt, dt: number, input?: JkInput): JkEv[] => {
	const evs: JkEv[] = [];
	if (st.ended) return evs;
	if (!st.started) {
		st.started = true;
		enterSeg(st, 0, evs);
	}
	if (input && "quit" in input) {
		if (st.opt.watch || st.wall - st.quitAt <= QUIT_MS) {
			finish(st, evs, null);
			return evs;
		}
		st.quitAt = st.wall;
		evs.push({ t: "note", text: st.rules.quitNote });
	} else if (input && "pick" in input) answer(st, input.pick, input.ago, evs);
	else if (input && "press" in input)
		throw new Error("jikkyo: cue is not supported yet");
	const d = Math.max(0, dt);
	st.wall += d;
	rotateBins(st);
	runWaves(st, d);
	advance(st, d, evs);
	runFlow(st, evs, d);
	checkRoll(st);
	runFlow(st, evs, 0);
	emitLines(st, evs);
	st.ikioiMax = Math.max(st.ikioiMax, ikioiOf(st));
	checkEnd(st, evs);
	return evs;
};

export const jkView = (st: JkSt): JkView => {
	const w = st.win;
	return {
		res: Math.floor(st.res + 1e-9),
		part: st.part,
		no: Math.max(st.lastNo, Math.min(threadNo(st), 1000)),
		label: st.rules.roll.label(st.part),
		ikioi: ikioiOf(st),
		ikioiMax: st.ikioiMax,
		combo: st.combo,
		win: w
			? {
					left: w.untimed ? w.pick.open : Math.max(0, w.pick.open - w.elapsed),
					open: w.pick.open,
					untimed: w.untimed,
					reveal: w.phase === "reveal",
				}
			: null,
		seg: st.tl.segs[st.i] ?? null,
		t: st.t,
		total: st.tl.total,
		ended: st.ended,
		pace: paceOf(st),
	};
};

export const jkResult = (st: JkSt): JkResult | null => st.result;

// 実況の エンジン（純粋。DOM・保存・Math.random・data/ の import は なし）。
// 本館の ナイター実況（野球）と、あとで 足す 台本の 番組（映画館の 金曜ロード保守・劇場の 紅白・議会中継）が
// 同じ「スレの 経済」を 使う：予算・書きこみの 波・コンボ・998 で 止める・1000 と 次スレ・勢い・行の 書き手。
//
// - 時間割（JkTimeline）は 番組ごとの 組み立て役が 作る（野球は data/jikkyo/yakyu.ts の yakyuTimeline）。
//   この ファイルは 文も 球団も 知らない（引数で もらう）。
// - 名目の 時計（t）と 実際の 時計（wall）を 両方 持つ。予算・時間割は 名目、勢い・答えの 速さ・表示は 実際。
// - 乱数は jkStart の opt.rand だけ（UI は Math.random、試験は 種つき）。冒険の 乱数・記録・リプレイには 触らない。
// - 窓は 2つの 形：blocking（区切りが 窓。早じまいで 残りの 予算を どっと 流す。野球）と
//   overlay（時計を 止めない。台本の 番組。映画館の『空飛ぶ鯖』）。
//   overlay には 山場の 1語（Cue：合図 3回、4拍目が ちょうど）と 950 の 当番（次スレの 切れ目の 長さを 決める）が つく。
//   台本の 番組は compileScript() で 時間割に する（区切り・窓・Cue・目立つ 書きこみ・鯖が 重い・スレタイの かえ）。
//   劇場の 紅白は 答えない ことが 正解の 窓（timeoutFit：除夜の 鐘で 黙る）と、キリコの 名前欄
//   （0時までは 番組の 時計「新年まで＠…」、山場の あとは Cue の names＝おみくじ）を 使う。
//   interactive:false（議会中継）は 見るだけの 番組：窓も 当番も 持たず、目立つ 書きこみ（議長・住人の 2行）を
//   時刻どおりに 出して ヤジを まぜる。B 1回で 閉じる。早送りは UI が dt を のばす。
//   blocking の 窓の timeoutFit は 型だけ 置き、使えば jkStart が 投げる。
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

export type JkOpt = {
	readonly text: string;
	readonly fit: JkFit;
	/** この 文を えらんで 外した ときの 群衆の pool（釣り札への 返し。無ければ 窓の boo）。 */
	readonly boo?: string;
};

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
	 * dup なら どの 行も ◎ の 文で、直近に 出ていても 書く（番組：選んだ レスを 群衆が かさねる）。
	 */
	readonly echo?: {
		readonly who: JkWho;
		readonly n: readonly [number, number];
		readonly alt?: readonly string[];
		readonly dup?: boolean;
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
	/**
	 * 答えない ときの 判定（紅白の 除夜の 鐘で 黙る＝◎）。時間切れで その 合い・速さ 1.0・コンボ +1。
	 * overlay の 窓だけ（blocking の 窓では まだ 使えない）。
	 */
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

/**
 * 山場の 1語（バルス／あけおめ）。開いてから beat ごとに 合図を pulses 回、その 次の 拍が ちょうど。
 * 窓は ちょうど ＋ 1.5 beat まで。ちょうどの 時に 群衆の 洪水（flood の pool）。
 */
export type JkCue = {
	readonly type: "cue";
	readonly id: string;
	readonly word: string;
	readonly beat: number;
	readonly pulses: number;
	readonly weight: number;
	readonly flood: string;
	/** 神エイムへの 返し（{n} は キリコの レス番）。洪水の はじめの 10行 以内に 入る。 */
	readonly praise?: string;
	/** 山場が スレの 切れ目に かかった とき：切れ目の 群衆の 1行と、新しい スレで 打てた ときの 1行。 */
	readonly cross?: { readonly gap: string; readonly fresh: string };
	/** 判定の あとの キリコの 名前欄（紅白の おみくじ「あけおめ＠大吉」。見てただけは 窓が 閉じた とき）。 */
	readonly names?: Readonly<Record<JkCueGrade, string>>;
};
export type JkWin = JkPick | JkCue;

/** 目立つ 書きこみ（速記ニキ・システム・議長）。at は 区切りの 頭から。pin は スレの 上に 止める ms。 */
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
	/**
	 * スレタイを かえる（n は スレ番）。now は いまの スレを すぐ かえ、この あとの スレも その 名前。
	 * next は 次の 1本だけ（null で 取り消す）。later は 次の スレから ずっと（紅白の 年越し→初日の出）。
	 */
	readonly title?: {
		readonly now?: (n: number) => string;
		readonly next?: ((n: number) => string) | null;
		readonly later?: (n: number) => string;
	};
	/** 鯖が　重い（行を 止める ms。数は 進む）。 */
	readonly stall?: number;
	readonly heat?: number;
	/** TV の ための 中身（野球の 打席・番組の 場面の 小さな 中身）。 */
	readonly data?: unknown;
};

export type JkTimeline = {
	readonly segs: readonly JkSeg[];
	/** 時計を 止めない 窓（overlay の 番組。at は 名目の ms、並びは 時刻順）。 */
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

/**
 * 950 の 当番（番組だけ）。レス番が 950 に なった とき、ほかの 窓が なく、次の 窓まで toPick、Cue の 前後 toCue
 * あいて いて、上映で max 回 未満なら 当番の 窓を 出す（1回目は pin と first、2回目からは variants の どれか）。
 * 答えは 1000 の あとの 切れ目の 長さを 決める（roll.gap）。出さない スレは 名無しが 立てる（切れ目 auto）。
 * 当番の 窓は P に 数えない（同じ P で 点を つける ボーナス）。pin の {m} は 次の スレ番。
 */
export type JkDuty = {
	readonly pin: string;
	readonly first: readonly JkOpt[];
	readonly variants: readonly {
		readonly pin: string;
		readonly opts: readonly JkOpt[];
	}[];
	readonly max: number;
	readonly toPick: number;
	readonly toCue: number;
	readonly auto: number;
	readonly open: number;
	readonly after?: JkAfter;
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
	/** false＝見るだけの 番組（議会中継。窓・当番なし、B 1回で 閉じる）。 */
	readonly interactive: boolean;
	/** ここで ふつうの 行を 止める（998）。 */
	readonly hold: number;
	readonly roll: JkRoll;
	readonly duty?: JkDuty;
	/**
	 * キリコの 名前欄（名目の 時刻 → 文。null は 名無し）。紅白の 0時までの「新年まで＠00:12:34」。
	 * Cue の names で 決まった 名前（おみくじ）が あれば そちらが 勝つ。
	 */
	readonly myName?: (t: number) => string | null;
	readonly display: {
		readonly perRes: number;
		readonly min: number;
		readonly max: number;
		readonly burst: number;
		readonly burstReduced: number;
		/** Cue の 洪水の あいだの 行/秒（省くと burst）。 */
		readonly flood?: number;
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
	/** 名前欄（キリコの レスだけ。紅白の 時計・おみくじ）。 */
	readonly name?: string;
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
	| { readonly t: "grade"; readonly grade: JkCueGrade; readonly gain: number }
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
		/** 窓の 種類（blocking の 窓と overlay の 窓は pick、当番は duty、山場は cue）。 */
		readonly kind: "pick" | "duty" | "cue";
		readonly w: JkWin;
		/** Cue：出した 合図の 数と、ちょうどまでの 名目の ms（過ぎたら 負）。 */
		readonly cue?: { readonly pulses: number; readonly exactIn: number };
	} | null;
	/** いまの 区切り（野球の at1000 は seg.data の 点差を 読む）。 */
	readonly seg: JkSeg | null;
	readonly t: number;
	readonly total: number;
	readonly ended: boolean;
	/** 直近 2秒の レス／秒（進み具合の バーの 見こみ）。 */
	readonly pace: number;
	/** いまの スレタイ。 */
	readonly title: string;
	/** 鯖が　重い（行が 止まって いる）。 */
	readonly stall: boolean;
	/** 1000 の あとの 切れ目（数が のびない）。 */
	readonly gap: boolean;
	/** Cue の 洪水。 */
	readonly flood: boolean;
	/** G（goal × 1000）。 */
	readonly G: number;
	/** いまの キリコの 名前欄（紅白の 時計・おみくじ。無ければ null）。 */
	readonly name: string | null;
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

const shuffled = <T>(list: readonly T[], rand: JkRand): T[] => {
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
	/** 窓の ◎ を なぞる（直近に 出ていれば alt から。dup なら 直近でも first）。 */
	readonly echo?: {
		readonly first: string | null;
		readonly alt: readonly string[];
		readonly dup?: boolean;
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

type FlowStep = {
	readonly at: number;
	readonly run: (evs: JkEv[]) => void;
	/** true の あいだ 待つ（番組の 切れ目：当番の 答えで 長さが きまる）。 */
	readonly wait?: () => boolean;
};

/** overlay の 窓（pick・当番・Cue）。elapsed は 開いてから（ms）。 */
type OvSt = {
	readonly win: JkWin;
	readonly duty: boolean;
	phase: "open" | "reveal";
	elapsed: number;
	revealLeft: number;
	readonly banned: ReadonlySet<string>;
	/** Cue：出した 合図・押した・洪水を 出した。 */
	pulses: number;
	pressed: boolean;
	flooded: boolean;
};
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
	// ── overlay の 番組
	/** 時刻順の overlay の 窓と、次に 開く 番。 */
	readonly ovs: readonly { readonly at: number; readonly win: JkWin }[];
	ovNext: number;
	ov: OvSt | null;
	/** Cue を 押した ときの ago（時計を 進めて から 判定する）。 */
	press: number | null;
	cueGrade: JkCueGrade | null;
	/** 神エイムの 返しを 洪水に 入れる（まだ 洪水の 前）。 */
	praise: string | null;
	/** 切れ目に かかった Cue の あとで、新しい スレの 頭に 出す 1行。 */
	fresh: string | null;
	/** 当番：決めた スレ・出した 回数・この スレで 出したか・答え（null は まだ）・答えた 実際の 時刻。 */
	dutyPart: number;
	dutyN: number;
	dutyShown: boolean;
	dutyFit: JkFit | "none" | null;
	dutyAt: number;
	/** 切れ目（1000 の 行の 実際の 時刻から）と、切れ目の あいだに 出す 1行。 */
	gapOn: boolean;
	t1000: number;
	gapExtra: string[];
	/** 区切りの 目立つ 書きこみ（名目の 時刻）。 */
	posts: { readonly at: number; readonly post: JkPost }[];
	stallUntil: number;
	floodUntil: number;
	floodOn: boolean;
	/** スレタイ（いまの 名前・この あとの 名前の 作り方・次の 1本だけの 作り方）。 */
	title: string;
	titleFn: ((n: number) => string) | null;
	nextTitle: ((n: number) => string) | null;
	/** 次の スレから ずっと 使う 作り方（roll で titleFn に うつす）。 */
	laterTitle: ((n: number) => string) | null;
	/** Cue の names で 決まった キリコの 名前欄（おみくじ）。 */
	myName: string | null;
};

const BIN_MS = 100;
const BINS = 100; // 10秒
const PACE_BINS = 20; // 2秒
const QUIT_MS = 1500;
const BURST_MS = 2000;

/** まだ 入れていない 機能・まぜては いけない 形を はじく（使う 番組の 手順で 入れる）。 */
const guard = (tl: JkTimeline, rules: JkRules): void => {
	const no = (why: string) => {
		throw new Error(`jikkyo: ${why} is not supported yet`);
	};
	const overlay = rules.windowMode === "overlay";
	if (tl.overlays.length && !overlay) no("overlay windows in blocking mode");
	// 見るだけの 番組（議会中継）は 窓も 当番も 持たない
	if (
		!rules.interactive &&
		(tl.overlays.length || tl.segs.some((s) => s.win) || rules.duty)
	)
		no("windows in a view-only program");
	if (!overlay && rules.duty) no("the 950 duty in blocking mode");
	if (!overlay && Object.values(rules.roll.gap).some((g) => g > 0))
		no("thread gaps in blocking mode");
	for (const s of tl.segs) {
		if (overlay && s.win) no("blocking windows in overlay mode");
		// 答えない ことが 正解の 窓は overlay（紅白の 鐘）だけ
		if (s.win?.timeoutFit) no("timeoutFit in blocking windows");
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
		ovs: [...tl.overlays].sort((a, b) => a.at - b.at),
		ovNext: 0,
		ov: null,
		press: null,
		cueGrade: null,
		praise: null,
		fresh: null,
		dutyPart: -1,
		dutyN: 0,
		dutyShown: false,
		dutyFit: null,
		dutyAt: 0,
		gapOn: false,
		t1000: 0,
		gapExtra: [],
		posts: [],
		stallUntil: -1,
		floodUntil: -1,
		floodOn: false,
		title: rules.roll.title(part),
		titleFn: null,
		nextTitle: null,
		laterTitle: null,
		myName: null,
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
	for (const p of seg.posts ?? [])
		st.posts.push({ at: seg.start + p.at, post: p });
	if (seg.stall) st.stallUntil = st.wall + seg.stall;
	if (seg.title?.now) {
		st.titleFn = seg.title.now;
		st.title = seg.title.now(st.part);
		evs.push({ t: "retitle", title: st.title });
	}
	if (seg.title && "next" in seg.title) st.nextTitle = seg.title.next ?? null;
	if (seg.title?.later) st.laterTitle = seg.title.later;
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
	// 切れ目の あいだは のびない（その ぶんの 予算は 消える。1000 を こえた 書きこみが 消えるのと 同じ）
	if (st.gapOn) return;
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
	// 切れ目の あいだは 波を 止めて おく（新しい スレで 続きを 流す）
	if (!st.waves.length || st.gapOn) return;
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

/**
 * 窓が 閉じた あとの 並び。chosen は キリコが 書いた 文（見送り・黙って 当てた ときは null。
 * その ときは アンカー返信を 出さない）。外した 文に boo が あれば 窓の boo より 先に。
 */
const closeSeq = (
	st: JkSt,
	pick: JkPick,
	fit: JkFit | null,
	chosen: JkOpt | null = null,
): QItem[] => {
	const seq: QItem[] = [];
	const r = st.rand;
	const between = ([a, b]: readonly [number, number]) =>
		a + Math.floor(r() * (b - a + 1));
	const rep = fit && chosen ? pick.after?.replies?.[fit] : undefined;
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
				echo: {
					first: echo.dup || !seq.some((x) => x.echo) ? best : null,
					alt,
					dup: echo.dup,
				},
			});
	}
	const crowd =
		fit === "best" || fit === "ok"
			? pick.after?.cheer
			: (chosen?.boo ?? pick.after?.boo);
	if (crowd) seq.push({ req: { who: "nanashi", pool: crowd } });
	return seq;
};

/** キリコの いまの 名前欄（おみくじが 決まって いれば それ、なければ 番組の 時計）。 */
const nameOf = (st: JkSt): string | null =>
	st.myName ?? st.rules.myName?.(st.t) ?? null;

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
	const name = nameOf(st);
	evs.push({
		t: "line",
		line: {
			no: n,
			part: st.part,
			who: "me",
			text,
			cls: "me",
			...(name ? { name } : {}),
		},
	});
};

/**
 * 押した 時（窓の 中の ms）。入力は 時計を 進める 前に 受けるので、この 歩の 終わり（elapsed ＋ d）から ago を
 * 引く。締め切りの まぎわに 押して 歩を またいだ ぶんは 締め切りに 丸める。
 */
const pressedAt = (
	elapsed: number,
	d: number,
	ago: number,
	open: number,
): number => Math.min(open, Math.max(0, elapsed + d - Math.max(0, ago)));

const answer = (
	st: JkSt,
	i: number,
	ago: number,
	d: number,
	evs: JkEv[],
): void => {
	const w = st.win;
	if (w?.phase !== "open") return;
	const opt = w.pick.opts[i];
	if (!opt) return;
	const r = st.rules;
	const ms = pressedAt(w.elapsed, d, ago, w.pick.open);
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
	st.q.unshift(...closeSeq(st, w.pick, opt.fit, opt));
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

// ───────────────── overlay の 窓（番組：時計を 止めない） ─────────────────

/** Cue の 判定（ずれ ＝ 押した 時 − ちょうど。0.22 beat 以内が 神エイム、0.55 beat 以内が おしい）。 */
export const gradeCue = (
	cue: Pick<JkCue, "beat">,
	exactMs: number,
	pressMs: number | null,
): JkCueGrade => {
	if (pressMs === null) return "none";
	const d = pressMs - exactMs;
	if (Math.abs(d) <= 0.22 * cue.beat + 1e-9) return "kami";
	if (Math.abs(d) <= 0.55 * cue.beat + 1e-9) return "oshii";
	return d < 0 ? "flying" : "late";
};

/** Cue の 判定 → 合いと 速さの 重み。 */
const CUE_FIT: Readonly<
	Record<Exclude<JkCueGrade, "none">, { fit: JkFit; speed: number }>
> = {
	kami: { fit: "best", speed: 1 },
	oshii: { fit: "ok", speed: 0.85 },
	flying: { fit: "miss", speed: 0.7 },
	late: { fit: "ok", speed: 0.85 },
};

/** 開いてから ちょうどまで・窓の 終わりまで（ms）。 */
const cueExact = (c: JkCue): number => c.pulses * c.beat;
const cueEnd = (c: JkCue): number => (c.pulses + 1.5) * c.beat;

/** 洪水の 長さと 行の 数。 */
const FLOOD_MS = 2500;
const FLOOD_N = 16;
/** スレの 上に 止める 既定の ms。 */
export const PIN_MS = 2500;

const gainOf = (st: JkSt, weight: number, fit: JkFit, sp: number): number =>
	st.tl.P > 0
		? Math.round(
				((st.rules.post * st.G) / st.tl.P) * weight * st.rules.fit[fit] * sp,
			)
		: 0;

const openOv = (
	st: JkSt,
	win: JkWin,
	duty: boolean,
	elapsed: number,
	evs: JkEv[],
): OvSt => {
	const ov: OvSt = {
		win,
		duty,
		phase: "open",
		elapsed,
		revealLeft: 0,
		// Cue の 1語は 洪水で かさねるので 止めない
		banned:
			win.type === "pick" ? new Set(win.opts.map((o) => o.text)) : EMPTY_SET,
		pulses: 0,
		pressed: false,
		flooded: false,
	};
	st.ov = ov;
	evs.push({ t: "open", win, untimed: false });
	return ov;
};

const closeOv = (st: JkSt, evs: JkEv[]): void => {
	st.ov = null;
	evs.push({ t: "close" });
};

const toReveal = (st: JkSt, ov: OvSt): void => {
	ov.phase = "reveal";
	ov.revealLeft = st.rules.reveal;
	st.burstUntil = st.wall + BURST_MS;
};

const answerOv = (
	st: JkSt,
	i: number,
	ago: number,
	d: number,
	evs: JkEv[],
): void => {
	const ov = st.ov;
	if (ov?.phase !== "open" || ov.win.type !== "pick") return;
	const pick = ov.win;
	const opt = pick.opts[i];
	if (!opt) return;
	const r = st.rules;
	const ms = pressedAt(ov.elapsed, d, ago, pick.open);
	const gain = gainOf(st, pick.weight, opt.fit, speedOf(r, ms));
	st.combo = opt.fit === "miss" ? 0 : st.combo + 1;
	st.comboMax = Math.max(st.comboMax, st.combo);
	st.counts[opt.fit]++;
	wave(st, gain, r.wave);
	evs.push({
		t: "reveal",
		chosen: i,
		fit: opt.fit,
		gain,
		fast: ms <= (r.speed[0]?.[0] ?? 0),
	});
	evs.push({ t: "combo", combo: st.combo });
	postMine(st, opt.text, evs);
	st.q.unshift(...closeSeq(st, pick, opt.fit, opt));
	if (ov.duty) {
		st.dutyFit = opt.fit;
		st.dutyAt = st.wall;
	}
	toReveal(st, ov);
};

const timeoutOv = (st: JkSt, evs: JkEv[]): void => {
	const ov = st.ov;
	if (ov?.phase !== "open" || ov.win.type !== "pick") return;
	const tf = ov.duty ? undefined : ov.win.timeoutFit;
	if (tf) {
		// 黙って いる ことが 答え（紅白の 除夜の 鐘）：その 合い・速さ 1.0・コンボ +1。キリコは 書かない
		const gain = gainOf(st, ov.win.weight, tf, 1);
		st.combo = tf === "miss" ? 0 : st.combo + 1;
		st.comboMax = Math.max(st.comboMax, st.combo);
		st.counts[tf]++;
		wave(st, gain, st.rules.wave);
		evs.push({ t: "reveal", chosen: null, fit: tf, gain, fast: false });
		evs.push({ t: "combo", combo: st.combo });
		st.q.unshift(...closeSeq(st, ov.win, tf));
		toReveal(st, ov);
		return;
	}
	st.combo = Math.floor(st.combo / 2);
	st.counts.none++;
	evs.push({ t: "reveal", chosen: null, fit: null, gain: 0, fast: false });
	evs.push({ t: "combo", combo: st.combo });
	st.q.unshift(...closeSeq(st, ov.win, null));
	if (ov.duty) {
		st.dutyFit = "none";
		st.dutyAt = st.wall;
	}
	toReveal(st, ov);
};

/** Cue の 判定を 点に する（見てただけは コンボ 半分）。 */
const gradeOv = (
	st: JkSt,
	cue: JkCue,
	grade: JkCueGrade,
	evs: JkEv[],
): void => {
	st.cueGrade = grade;
	// 紅白の おみくじ：この あとの キリコの 名前欄（山場の 1語の 書きこみにも つく）
	if (cue.names) st.myName = cue.names[grade];
	if (grade === "none") {
		st.combo = Math.floor(st.combo / 2);
		st.counts.none++;
		evs.push({ t: "grade", grade, gain: 0 });
		evs.push({ t: "combo", combo: st.combo });
		return;
	}
	const { fit, speed } = CUE_FIT[grade];
	const gain = gainOf(st, cue.weight, fit, speed);
	st.combo = fit === "miss" ? 0 : st.combo + 1;
	st.comboMax = Math.max(st.comboMax, st.combo);
	st.counts[fit]++;
	wave(st, gain, st.rules.wave);
	evs.push({ t: "grade", grade, gain });
	evs.push({ t: "combo", combo: st.combo });
};

/** 神エイムへの 返し（キリコの レス番への アンカー）。 */
const praiseItem = (text: string): QItem => ({
	req: { who: "nanashi", text },
	anc: true,
	cls: "anc",
});

/** Cue を 押した（at は 開いてから 押した 時。時計を 進めた あとで よぶ）。 */
const pressCue = (st: JkSt, ov: OvSt, cue: JkCue, ago: number, evs: JkEv[]) => {
	if (ov.pressed) return;
	ov.pressed = true;
	const grade = gradeCue(cue, cueExact(cue), ov.elapsed - Math.max(0, ago));
	gradeOv(st, cue, grade, evs);
	const deferred = st.deferredMe.length;
	postMine(st, cue.word, evs);
	// 切れ目に かかって 新しい スレへ 回った：>>1 の あとに「新スレで　バルス　できた」
	if (st.deferredMe.length > deferred && cue.cross) st.fresh = cue.cross.fresh;
	if (grade === "kami" && cue.praise) {
		if (ov.flooded)
			st.q.splice(Math.min(2, st.q.length), 0, praiseItem(cue.praise));
		else st.praise = cue.praise;
	}
};

/** ちょうどの 拍：群衆の 洪水（神エイムなら 返しを はじめの 3行目に）。 */
const startFlood = (st: JkSt, cue: JkCue, evs: JkEv[]): void => {
	st.floodUntil = st.wall + FLOOD_MS;
	if (!st.floodOn) {
		st.floodOn = true;
		evs.push({ t: "flood", on: true });
	}
	const items: QItem[] = Array.from({ length: FLOOD_N }, () => ({
		req: { who: "nanashi", pool: cue.flood },
	}));
	if (st.praise) {
		items.splice(2, 0, praiseItem(st.praise));
		st.praise = null;
	}
	st.q.unshift(...items);
	if (st.gapOn && cue.cross) st.gapExtra.push(cue.cross.gap);
};

const tickCue = (st: JkSt, ov: OvSt, cue: JkCue, evs: JkEv[]): void => {
	while (ov.pulses < cue.pulses && ov.elapsed >= ov.pulses * cue.beat - 1e-9) {
		evs.push({ t: "pulse", i: ov.pulses });
		ov.pulses++;
	}
	if (st.press !== null) {
		pressCue(st, ov, cue, st.press, evs);
		st.press = null;
	}
	if (!ov.flooded && ov.elapsed >= cueExact(cue) - 1e-9) {
		ov.flooded = true;
		startFlood(st, cue, evs);
	}
	if (ov.elapsed >= cueEnd(cue) - 1e-9) {
		if (!ov.pressed) gradeOv(st, cue, "none", evs);
		closeOv(st, evs);
	}
};

/** 新しい 窓の ために いまの 窓を 閉じる（答えて いなければ 見送り）。 */
const forceClose = (st: JkSt, evs: JkEv[]): void => {
	const ov = st.ov;
	if (!ov) return;
	if (ov.phase === "open") {
		if (ov.win.type === "cue") {
			if (!ov.pressed) gradeOv(st, ov.win, "none", evs);
		} else timeoutOv(st, evs);
	}
	closeOv(st, evs);
};

/** overlay の 窓を 進める（開く・時間切れ・答え合わせ・Cue の 合図）。 */
const runOverlays = (st: JkSt, dt: number, evs: JkEv[]): void => {
	const ov = st.ov;
	if (ov) {
		ov.elapsed += dt;
		if (ov.win.type === "cue") tickCue(st, ov, ov.win, evs);
		else if (ov.phase === "open") {
			if (ov.elapsed >= ov.win.open - 1e-9) timeoutOv(st, evs);
		} else {
			ov.revealLeft -= dt;
			if (ov.revealLeft <= 1e-9) closeOv(st, evs);
		}
	}
	while (st.ovNext < st.ovs.length && st.ovs[st.ovNext].at <= st.t + 1e-9) {
		const o = st.ovs[st.ovNext++];
		if (st.ov) forceClose(st, evs);
		const next = openOv(st, o.win, false, Math.max(0, st.t - o.at), evs);
		if (o.win.type === "cue") tickCue(st, next, o.win, evs);
	}
	if (st.press !== null && st.ov?.win.type !== "cue") st.press = null;
};

/** 次の pick（当番を のぞく）までの 名目の ms。 */
const nextPickIn = (st: JkSt): number => {
	for (let k = st.ovNext; k < st.ovs.length; k++)
		if (st.ovs[k].win.type === "pick") return st.ovs[k].at - st.t;
	return Number.POSITIVE_INFINITY;
};

/** Cue の 前後 margin ms の 中か。 */
const nearCue = (st: JkSt, margin: number): boolean =>
	st.ovs.some(
		(o) =>
			o.win.type === "cue" &&
			st.t >= o.at - margin &&
			st.t <= o.at + cueEnd(o.win) + margin,
	);

/**
 * 950 の 当番（スレに 1回まで）。950 から 999 の あいだに 出せる 時が 来れば 出す
 * （踏んだ 人が だまって いれば 次の 人に 回る）。1000 まで 出せなければ 名無しが 立てる。
 */
const checkDuty = (st: JkSt, evs: JkEv[]): void => {
	const d = st.rules.duty;
	const no = threadNo(st);
	if (!d || st.flow || st.dutyPart === st.part || no < 950 || no > 990) return;
	if (
		st.ov ||
		st.dutyN >= d.max ||
		nextPickIn(st) < d.toPick ||
		nearCue(st, d.toCue)
	)
		return;
	st.dutyPart = st.part;
	st.dutyN++;
	st.dutyShown = true;
	st.dutyFit = null;
	const v =
		st.dutyN === 1 || !d.variants.length
			? { pin: d.pin, opts: d.first }
			: d.variants[Math.floor(st.rand() * d.variants.length)];
	const pin = {
		at: st.t,
		post: {
			at: 0,
			who: "nanashi",
			text: fillText(v.pin, { m: String(st.part + 1) }),
			pin: PIN_MS,
		},
	};
	if (!postNow(st, pin.post, evs)) st.posts.unshift(pin);
	const win: JkPick = {
		type: "pick",
		id: `duty${st.dutyN}`,
		opts: shuffled(v.opts, st.rand),
		open: d.open,
		weight: 1,
		...(d.after ? { after: d.after } : {}),
	};
	openOv(st, win, true, 0, evs);
};

/** 目立つ 書きこみを いま 出す（1000 の 流れ・鯖が 重い・998 で 止まって いる ときは 出せない）。 */
const postNow = (st: JkSt, p: JkPost, evs: JkEv[]): boolean => {
	if (st.flow || st.wall < st.stallUntil) return false;
	const no = Math.max(st.lastNo + 1, Math.min(threadNo(st), st.rules.hold));
	if (no > st.rules.hold) return false;
	st.lastNo = no;
	noteText(st.writer, p.who, p.text);
	const line: JkLine = {
		no,
		part: st.part,
		who: p.who,
		text: p.text,
		...(p.pin ? { cls: "pin" as const } : {}),
	};
	evs.push(p.pin ? { t: "pin", line, ms: p.pin } : { t: "line", line });
	return true;
};

const runPosts = (st: JkSt, evs: JkEv[]): void => {
	if (!st.posts.length) return;
	st.posts.sort((a, b) => a.at - b.at);
	while (st.posts.length && st.posts[0].at <= st.t + 1e-9) {
		if (!postNow(st, st.posts[0].post, evs)) break;
		st.posts.shift();
	}
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
		st.title = title;
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

/**
 * 切れ目の 終わり（実際の 時刻）。当番を 出した スレは 答えで 長さが きまる（◎ 0.3秒・○ 1.5秒・× と 見送り 2.5秒）。
 * 終わり ＝ max(1000 の 時, 答えた 時) ＋ 長さ。ただし 1000 から 見送りの 長さが いちばん 長い。出さない スレは auto。
 */
const gapEnd = (st: JkSt): number => {
	const g = st.rules.roll.gap;
	const t0 = st.t1000;
	if (!st.dutyShown) return t0 + (st.rules.duty?.auto ?? g.none);
	if (st.dutyFit === null) return t0 + g.none;
	return Math.min(t0 + g.none, Math.max(t0, st.dutyAt) + g[st.dutyFit]);
};

/**
 * 番組の 1000 の 流れ：999 → 1000（ここから 切れ目。数は のびない）→ 赤い 1001 を 上に 止める →
 * 切れ目の 終わりで スレを 消して >>1 → 立った スレの 波（31・サンイチ）→ 回して いた キリコの レス。
 */
const startGapFlow = (st: JkSt): void => {
	const r = st.rules.roll;
	const steps: FlowStep[] = [];
	const at = (ms: number, run: (evs: JkEv[]) => void) =>
		steps.push({ at: ms, run });
	const part = st.part;
	if (!st.has999)
		at(0, (evs) => {
			const req = fillerReq(st) ?? { who: "nanashi", pool: "nanashi" };
			const text = pickText(st.writer, req, st.rand, bannedNow(st));
			st.has999 = true;
			st.lastNo = 999;
			if (text)
				evs.push({ t: "line", line: { no: 999, part, who: req.who, text } });
		});
	at(200, (evs) => {
		const g = r.at1000(viewOf(st));
		st.lastNo = 1000;
		noteText(st.writer, g.who, g.text);
		evs.push({ t: "line", line: { no: 1000, part, who: g.who, text: g.text } });
		if (!st.kansoSent && st.res >= st.G - 1e-9) {
			st.kansoSent = true;
			evs.push({ t: "kanso" });
		}
		st.gapOn = true;
		st.t1000 = st.wall;
		evs.push({ t: "gap", on: true });
	});
	at(350, (evs) => {
		evs.push({
			t: "pin",
			line: { no: 1001, part, who: "sys", text: OVER_TEXT, cls: "over" },
			ms: PIN_MS,
		});
	});
	steps.push({
		at: 450,
		wait: () => st.wall < gapEnd(st) - 1e-9,
		run: (evs) => {
			st.gapOn = false;
			st.gapExtra = [];
			evs.push({ t: "gap", on: false });
			st.part = part + 1;
			st.lastNo = 1;
			st.has999 = false;
			st.me999 = false;
			st.dutyShown = false;
			st.dutyFit = null;
			if (st.laterTitle) {
				st.titleFn = st.laterTitle;
				st.laterTitle = null;
			}
			const fn = st.nextTitle ?? st.titleFn ?? r.title;
			st.nextTitle = null;
			st.title = fn(st.part);
			evs.push({ t: "roll", part: st.part, title: st.title });
			evs.push({
				t: "line",
				line: {
					no: 1,
					part: st.part,
					who: "nanashi",
					text: st.title,
					cls: "title",
				},
			});
			const open = r.open;
			if (open)
				st.q.unshift(
					...[0, 1, 2].map(() => ({ req: { who: "nanashi", pool: open } })),
				);
			at((st.flow?.el ?? 0) + 200, (e2) => {
				for (const text of st.deferredMe.splice(0)) postMine(st, text, e2);
				if (st.fresh) {
					st.q.unshift({ req: { who: "nanashi", text: st.fresh } });
					st.fresh = null;
				}
			});
		},
	});
	st.flow = { el: 0, steps };
};

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
		// 待つ 歩（番組の 切れ目）は 後ろの 歩も 止める（並びを 守る）
		if (f.steps[k].wait?.()) break;
		const [s] = f.steps.splice(k, 1);
		s.run(evs);
	}
	if (el >= st.rules.roll.flow && !f.steps.length) st.flow = null;
};

/** 番組の 流れ（当番か 切れ目が ある）。 */
const gapFlow = (r: JkRules): boolean =>
	!!r.duty || Object.values(r.roll.gap).some((g) => g > 0);

const checkRoll = (st: JkSt): void => {
	if (st.flow || st.ended) return;
	if (st.win) return; // blocking の 窓が 閉じるまで 待つ
	if (Math.floor(st.res + 1e-9) >= 1000 * (st.part - st.part0 + 1)) {
		if (gapFlow(st.rules)) startGapFlow(st);
		else startFlow(st);
	}
};

// ───────────────── 行を 出す ─────────────────

const rateOf = (st: JkSt): number => {
	const d = st.rules.display;
	let r = Math.max(d.min, Math.min(d.max, d.perRes * paceOf(st)));
	if (st.wall < st.burstUntil) r = Math.max(r, d.burst);
	if (st.wall < st.floodUntil) r = Math.max(r, d.flood ?? d.burst);
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
		const first = item.echo.first;
		if (item.echo.dup && first !== null && !banned.has(first)) {
			noteText(w, item.req.who, first);
			return first;
		}
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

/** 切れ目の あいだの 群衆（番号なし。次スレ　どこ？／乱立すな）。 */
const emitGapLines = (st: JkSt, evs: JkEv[]): void => {
	const interval = 1000 / rateOf(st);
	if (st.wall - st.lastLineAt < interval - 1e-6) return;
	st.lastLineAt = st.wall;
	const extra = st.gapExtra.shift();
	const pool = st.rules.roll.gapPool;
	let text: string | null = null;
	if (extra !== undefined) {
		noteText(st.writer, "nanashi", extra);
		text = extra;
	} else if (pool)
		text = pickText(
			st.writer,
			{ who: "nanashi", pool },
			st.rand,
			bannedNow(st),
		);
	if (text === null) return;
	evs.push({
		t: "line",
		line: { no: null, part: st.part, who: "nanashi", text },
	});
};

const emitLines = (st: JkSt, evs: JkEv[]): void => {
	if (st.gapOn) {
		emitGapLines(st, evs);
		return;
	}
	if (st.flow) return;
	// 鯖が　重い：行を 止める（数は 進む）
	if (st.wall < st.stallUntil) return;
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

/** overlay の 番組は 窓が 細かく 並ぶので、先読みを 短く。 */
const OV_LOOKAHEAD_MS = 8000;

/** overlay：開いて いる 窓と、もうすぐ 開く pick の 候補。 */
const bannedOv = (st: JkSt): ReadonlySet<string> => {
	const ov = st.ov;
	const cur = ov && ov.phase === "open" ? ov.banned : null;
	let next: JkPick | null = null;
	for (let k = st.ovNext; k < st.ovs.length; k++) {
		const o = st.ovs[k];
		if (o.at - st.t > OV_LOOKAHEAD_MS) break;
		if (o.win.type === "pick") {
			next = o.win;
			break;
		}
	}
	if (!next) return cur ?? EMPTY_SET;
	const out = new Set(cur ?? []);
	for (const o of next.opts) out.add(o.text);
	return out;
};

/** いま 群衆に 書かせない 文（開いて いる 窓と、もうすぐ 開く 窓の 候補）。 */
const bannedNow = (st: JkSt): ReadonlySet<string> => {
	if (st.rules.windowMode === "overlay") return bannedOv(st);
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
	cue: st.cueGrade,
	watch: !!st.opt.watch,
});

const checkEnd = (st: JkSt, evs: JkEv[]): void => {
	if (st.i < st.tl.segs.length || st.flow || st.win || st.ov || st.waves.length)
		return;
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
			const text = pickText(st.writer, req, st.rand, bannedNow(st));
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
	const overlay = st.rules.windowMode === "overlay";
	if (!st.started) {
		st.started = true;
		// 番組は スレが 立った ところから（>>1 に スレタイ）
		if (overlay)
			evs.push({
				t: "line",
				line: {
					no: 1,
					part: st.part,
					who: "nanashi",
					text: st.title,
					cls: "title",
				},
			});
		enterSeg(st, 0, evs);
	}
	const d = Math.max(0, dt);
	if (input && "quit" in input) {
		// 見るだけ・見るだけの 番組（議会中継）は B 1回で 閉じる
		if (
			st.opt.watch ||
			!st.rules.interactive ||
			st.wall - st.quitAt <= QUIT_MS
		) {
			finish(st, evs, null);
			return evs;
		}
		st.quitAt = st.wall;
		evs.push({ t: "note", text: st.rules.quitNote });
	} else if (input && "pick" in input) {
		// 答えは 時計を 進める 前に 受ける（締め切りの まぎわでも 間に合う）。速さは 押した 時で（pressedAt）
		if (overlay) answerOv(st, input.pick, input.ago, d, evs);
		else answer(st, input.pick, input.ago, d, evs);
	} else if (input && "press" in input) {
		// Cue は 時計を 進めて から 判定する（押した 時 ＝ 進めた あとの 時 − ago）
		const ov = st.ov;
		if (ov?.win.type === "cue" && ov.phase === "open" && !ov.pressed)
			st.press = input.ago;
	}
	st.wall += d;
	rotateBins(st);
	runWaves(st, d);
	advance(st, d, evs);
	if (overlay) {
		runOverlays(st, d, evs);
		checkDuty(st, evs);
	}
	runFlow(st, evs, d);
	checkRoll(st);
	runFlow(st, evs, 0);
	runPosts(st, evs);
	if (st.floodOn && st.wall >= st.floodUntil) {
		st.floodOn = false;
		evs.push({ t: "flood", on: false });
	}
	emitLines(st, evs);
	st.ikioiMax = Math.max(st.ikioiMax, ikioiOf(st));
	checkEnd(st, evs);
	return evs;
};

const ovView = (ov: OvSt): NonNullable<JkView["win"]> => {
	if (ov.win.type === "cue") {
		const end = cueEnd(ov.win);
		return {
			left: Math.max(0, end - ov.elapsed),
			open: end,
			untimed: false,
			reveal: ov.pressed,
			kind: "cue",
			w: ov.win,
			cue: { pulses: ov.pulses, exactIn: cueExact(ov.win) - ov.elapsed },
		};
	}
	return {
		left: Math.max(0, ov.win.open - ov.elapsed),
		open: ov.win.open,
		untimed: false,
		reveal: ov.phase === "reveal",
		kind: ov.duty ? "duty" : "pick",
		w: ov.win,
	};
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
					kind: "pick",
					w: w.pick,
				}
			: st.ov
				? ovView(st.ov)
				: null,
		seg: st.tl.segs[st.i] ?? null,
		t: st.t,
		total: st.tl.total,
		ended: st.ended,
		pace: paceOf(st),
		title: st.title,
		stall: st.wall < st.stallUntil,
		gap: st.gapOn,
		flood: st.floodOn,
		G: st.G,
		name: nameOf(st),
	};
};

export const jkResult = (st: JkSt): JkResult | null => st.result;

// ───────────────── 台本の 番組（映画館・劇場） ─────────────────

/** 番組の 枠（live＝本放送。再上映・リハ・録画は live:false）。y は 年（紅白の 回）。 */
export type JkSlot = {
	readonly program: string;
	readonly live: boolean;
	readonly mode?: "reha" | "rec";
	readonly y: number;
	readonly day?: number;
};
export type JkTitleFn = (n: number, slot: JkSlot) => string;
export type JkBot = "kami" | "jouzu" | "shoshin" | "futsuu" | "random" | "miru";
/** 試験の 帯。kanso は 完走の 割合の はば、p50 は res の 中央値 ÷ G の はば。 */
export type JkBands = {
	readonly kanso?: Partial<Record<JkBot, readonly [number, number]>>;
	readonly p50?: Partial<Record<JkBot, readonly [number, number]>>;
};

/** 台本の 区切り（at は 名目の ms。dur は 次の at まで、最後は length まで）。 */
export type JkScriptSeg = {
	readonly at: number;
	readonly scene: string;
	/** 群衆の pool。 */
	readonly pool: string;
	/** 群衆の 重み（1 が ふつう。山場 3〜3.5）。 */
	readonly rate: number;
	readonly caption?: string;
	readonly bgm?: string | null;
	readonly title?: {
		readonly now?: JkTitleFn;
		readonly next?: JkTitleFn | null;
		readonly later?: JkTitleFn;
	};
	/** 区切りの 頭で スレの 上に 止める 書きこみ。 */
	readonly pin?: string;
	readonly stall?: number;
	readonly posts?: readonly JkPost[];
	readonly react?: readonly JkReq[];
	readonly data?: unknown;
};
export type JkScriptPick = {
	readonly at: number;
	readonly open?: number;
	/** 2〜3 通りの 組（乱数で 1つ）。 */
	readonly sets: readonly (readonly JkOpt[])[];
	readonly weight?: number;
	readonly timeoutFit?: JkFit;
	/** 当てた／外した あとの 群衆の pool。 */
	readonly cheer?: string;
	readonly boo?: string;
};
export type JkScriptCue = {
	readonly at: number;
	readonly word: string;
	readonly beat: number;
	readonly pulses: number;
	readonly flood: string;
	readonly weight?: number;
	readonly praise?: string;
	readonly cross?: { readonly gap: string; readonly fresh: string };
	readonly names?: Readonly<Record<JkCueGrade, string>>;
};
export type JkScriptTimeline = {
	readonly segments: readonly JkScriptSeg[];
	readonly picks: readonly JkScriptPick[];
	readonly cues: readonly JkScriptCue[];
};

export type JkScript = {
	readonly id: string;
	readonly venue: string;
	/** 名目の 長さ（160000 まで）。 */
	readonly length: number;
	/** スレの 数（★）。 */
	readonly goal: {
		readonly live: number;
		readonly rerun: number;
		readonly reha?: number;
		readonly rec?: number;
	};
	readonly pools: JkPools;
	readonly title: JkTitleFn;
	/** ヘッダーの 左（省くと『★n』）。 */
	readonly label?: (n: number, slot: JkSlot) => string;
	/** 1000 の 行（「1000なら　来週も　鯖」）。 */
	readonly at1000: (n: number, slot: JkSlot) => string;
	/** 立った スレの 頭の 波・切れ目の 群衆の pool。 */
	readonly open: string;
	readonly gapPool: string;
	readonly duty: Pick<JkDuty, "pin" | "first" | "variants">;
	/** キリコの レスへの アンカー返信（{n}）。 */
	readonly replies?: JkAfter["replies"];
	/** ◎ を かさねる 群衆の 数。 */
	readonly echoN?: readonly [number, number];
	/** その 枠だけ 群衆に まぜる pool（再上映の「何回　やるねん」など）。 */
	readonly extra?: readonly {
		readonly pool: string;
		readonly p: number;
		readonly when: (slot: JkSlot) => boolean;
	}[];
	readonly quitNote: string;
	/** キリコの 名前欄（名目の 時刻 → 文。紅白の 0時までの 時計）。 */
	readonly name?: (t: number, slot: JkSlot) => string | null;
	/** 帯を 外れた ときだけ 動かす（post・boost・comboMin）。 */
	readonly tune?: Partial<Pick<JkRules, "post" | "boost" | "comboMin">>;
	readonly bands: JkBands;
	readonly timeline: (rand: JkRand, slot: JkSlot) => JkScriptTimeline;
};

/** 台本の 番組の 既定の 決まり（ENGINE §4.5。番組ごとに かえて よいのは tune だけ）。 */
export const PROGRAM_RULES = {
	idle: 0.58,
	post: 0.28,
	boost: 1,
	comboMin: 10,
	comboDen: 0,
	fit: { best: 1, ok: 0.5, miss: 0.15 },
	speed: [
		[1000, 1],
		[2000, 0.85],
		[4000, 0.7],
	],
	reveal: 800,
	wave: 1500,
	watchHold: 1500,
	open: 4000,
	gap: { best: 300, ok: 1500, miss: 2500, none: 2500 },
	duty: { max: 2, toPick: 4500, toCue: 6000, auto: 800 },
	display: {
		perRes: 0.1,
		min: 1.5,
		max: 4,
		burst: 6,
		burstReduced: 4,
		flood: 14,
	},
	recent: 4,
} as const;

/** 枠の 目標（★）。 */
export const scriptGoal = (p: JkScript, slot: JkSlot): number =>
	slot.live
		? p.goal.live
		: slot.mode === "reha"
			? (p.goal.reha ?? p.goal.rerun)
			: slot.mode === "rec"
				? (p.goal.rec ?? p.goal.rerun)
				: p.goal.rerun;

/**
 * 台本 → 時間割・決まり・pool。区切りの dur は 次の at まで、群衆の 重みは rate × dur。
 * pick は 組を rand で 1つ（P に weight）、Cue は 開く 時が 1つめの 合図（P に weight、既定 2）。
 */
export const compileScript = (
	p: JkScript,
	slot: JkSlot,
	rand: JkRand,
): { tl: JkTimeline; rules: JkRules; pools: JkPools } => {
	const D = PROGRAM_RULES;
	const tlx = p.timeline(rand, slot);
	const segsIn = [...tlx.segments].sort((a, b) => a.at - b.at);
	const extra = (p.extra ?? [])
		.filter((e) => e.when(slot))
		.map((e) => ({ who: "nanashi", pool: e.pool, p: e.p }));
	const segs: JkSeg[] = segsIn.map((s, i) => {
		const end = segsIn[i + 1]?.at ?? p.length;
		const dur = Math.max(1, end - s.at);
		const posts = [
			...(s.pin ? [{ at: 0, who: "nanashi", text: s.pin, pin: PIN_MS }] : []),
			...(s.posts ?? []),
		];
		const now = s.title?.now;
		const next = s.title?.next;
		const later = s.title?.later;
		return {
			start: s.at,
			dur,
			w: s.rate * dur,
			scene: s.scene,
			filler: [{ who: "nanashi", pool: s.pool, p: 1 }, ...extra],
			...(s.caption ? { caption: s.caption } : {}),
			...(s.bgm !== undefined ? { bgm: s.bgm } : {}),
			...(posts.length ? { posts } : {}),
			...(s.stall ? { stall: s.stall } : {}),
			...(s.react?.length ? { react: s.react } : {}),
			...(s.data !== undefined ? { data: s.data } : {}),
			...(s.title
				? {
						title: {
							...(now ? { now: (n: number) => now(n, slot) } : {}),
							...(next !== undefined
								? { next: next ? (n: number) => next(n, slot) : null }
								: {}),
							...(later ? { later: (n: number) => later(n, slot) } : {}),
						},
					}
				: {}),
		};
	});
	const echo = {
		who: "nanashi",
		n: p.echoN ?? ([1, 2] as const),
		dup: true,
	};
	const overlays: { at: number; win: JkWin }[] = [
		...tlx.picks.map((k, i) => {
			// 組を 1つ えらび、ボタンの 並びも まぜる（◎ の 位置で 覚えない）
			const opts = shuffled(
				k.sets[Math.floor(rand() * k.sets.length)] ?? [],
				rand,
			);
			const win: JkPick = {
				type: "pick",
				id: `p${i}`,
				opts,
				open: k.open ?? D.open,
				weight: k.weight ?? 1,
				...(k.timeoutFit ? { timeoutFit: k.timeoutFit } : {}),
				after: {
					...(p.replies ? { replies: p.replies } : {}),
					echo,
					...(k.cheer ? { cheer: k.cheer } : {}),
					...(k.boo ? { boo: k.boo } : {}),
				},
			};
			return { at: k.at, win };
		}),
		...tlx.cues.map((c, i) => {
			const win: JkCue = {
				type: "cue",
				id: `c${i}`,
				word: c.word,
				beat: c.beat,
				pulses: c.pulses,
				weight: c.weight ?? 2,
				flood: c.flood,
				...(c.praise ? { praise: c.praise } : {}),
				...(c.cross ? { cross: c.cross } : {}),
				...(c.names ? { names: c.names } : {}),
			};
			return { at: c.at, win };
		}),
	].sort((a, b) => a.at - b.at);
	const P = overlays.reduce((s, o) => s + o.win.weight, 0);
	const goal = scriptGoal(p, slot);
	const label = (n: number) => p.label?.(n, slot) ?? `★${n}`;
	const rules: JkRules = {
		goal,
		idle: D.idle,
		post: p.tune?.post ?? D.post,
		boost: p.tune?.boost ?? D.boost,
		comboMin: p.tune?.comboMin ?? D.comboMin,
		comboDen: D.comboDen,
		fit: D.fit,
		speed: D.speed,
		reveal: D.reveal,
		wave: D.wave,
		watchHold: D.watchHold,
		windowMode: "overlay",
		interactive: true,
		hold: 998,
		roll: {
			at1000: (v) => ({ who: "nanashi", text: p.at1000(v.part, slot) }),
			title: (n) => p.title(n, slot),
			label,
			open: p.open,
			gap: D.gap,
			gapPool: p.gapPool,
			flow: 0,
		},
		duty: {
			...p.duty,
			...D.duty,
			open: D.open,
			...(p.replies ? { after: { replies: p.replies } } : {}),
		},
		...(p.name ? { myName: (t: number) => p.name?.(t, slot) ?? null } : {}),
		display: D.display,
		writer: {
			recent: D.recent,
			caps: {},
			repeatOk: [...new Set(tlx.cues.map((c) => c.flood))],
		},
		quitNote: p.quitNote,
	};
	return {
		tl: { segs, overlays, total: p.length, P },
		rules,
		pools: p.pools,
	};
};

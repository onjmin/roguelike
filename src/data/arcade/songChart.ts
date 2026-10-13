// BGM の 譜面（MML）から 音ゲーの 札を 作る（2026-10-13 作者：「実際の ゲームに 使われている BGM に
// 合わせた 音ゲーに すると 没入感が 向上する」）。ゲームセンターの「おんJビート」と キリコの 家の「おんJ太鼓」。
// MML は 板の がわ（ui/arcade/songPlay.ts）が dtm の parseMML で 音符に 読みかえて わたす。ここは DOM も dtm も 使わない。
//
// - 札は 旋律（ふつう @0。音が 少なすぎる ときは 次の 番号）の 鳴りはじめ。和音は 1つに まとめる。
// - 8分音符の 目に そろえ、間が minGapSec より 短い 音は 間引く（速い 曲でも 押せる 細かさに）。
// - 4つの 道は 旋律の 高さで 分ける（低い 音ほど 左。曲ごとに 音の 数が 4等分に なる しきい）。
//   同じ 高さの 連打は 同じ 道、上がれば 右、下がれば 左へ 寄る。
// - 太鼓は 1本の 道。拍の 頭（4分の 表）は ドン、裏拍と 大きく 跳ね上がった 音は カッ。
// - 曲は 旋律の 入る 小節の 頭から 鳴らし、maxSec を こえない 小節の きりで おわる。

/** dtm の parseMML の 音符（使う ところだけ）。 */
export type SongNote = {
	trackIndex: number;
	startStep: number;
	durationSteps: number;
	pitchUnits: number;
};

/** 1小節の ステップ（dtm の 既定）。 */
export const STEPS_PER_BAR = 192;
const STEPS_PER_BEAT = STEPS_PER_BAR / 4;
/** 8分の 目。 */
const GRID = STEPS_PER_BEAT / 2;

export type ChartNote = { at: number; lane: number };

export type SongChart = {
	/** 鳴らしはじめの ステップ（小節の 頭）。 */
	fromStep: number;
	/** 1ステップの 秒。 */
	sps: number;
	/** 札（曲の 鳴りはじめからの 秒）。 */
	notes: ChartNote[];
	/** おわりの 秒（さいごの 札の あと、小節の きり）。 */
	endSec: number;
};

export type ChartOpts = {
	/** 道の 数（太鼓は 2＝ドン・カッ）。 */
	lanes: number;
	minGapSec: number;
	maxSec: number;
	/** 鳴りはじめから これより 前の 札は 出さない（上から 降りてくる 間）。 */
	leadSec: number;
	taiko?: boolean;
};

export const BEAT_OPTS: ChartOpts = {
	lanes: 4,
	minGapSec: 0.22,
	maxSec: 70,
	leadSec: 1.4,
};
export const TAIKO_OPTS: ChartOpts = {
	lanes: 2,
	minGapSec: 0.2,
	maxSec: 70,
	leadSec: 1.4,
	taiko: true,
};

/** 札に する 音の 少なさの 下限（これより 少ない トラックは 旋律と みなさない）。 */
const MELODY_MIN = 40;

/** 旋律の トラック（作曲の 決まりで @0。音が 少なすぎれば 音の 多い うち いちばん 小さい 番号）。 */
export const melodyTrack = (notes: readonly SongNote[]): number | null => {
	const count = new Map<number, number>();
	for (const n of notes)
		count.set(n.trackIndex, (count.get(n.trackIndex) ?? 0) + 1);
	const ids = [...count.keys()].sort((a, b) => a - b);
	const enough = ids.filter((i) => (count.get(i) ?? 0) >= MELODY_MIN);
	return enough[0] ?? ids[0] ?? null;
};

/** 太鼓で カッに する 跳躍（半音 4つ。12平均律の 1半音 = 31 units）。 */
const KA_LEAP = 4 * 31;

/** 音符と BPM から 札。旋律が 無ければ null。 */
export const songChart = (
	all: readonly SongNote[],
	bpm: number,
	opts: ChartOpts,
): SongChart | null => {
	const track = melodyTrack(all);
	if (track === null || !(bpm > 0)) return null;
	const sps = 60 / bpm / STEPS_PER_BEAT;
	// 鳴りはじめ（和音は いちばん 高い 音）。8分の 目に そろえる
	const onset = new Map<number, number>();
	for (const n of all) {
		if (n.trackIndex !== track || n.durationSteps <= 0) continue;
		const at = Math.round(n.startStep / GRID) * GRID;
		onset.set(at, Math.max(onset.get(at) ?? -1, n.pitchUnits));
	}
	const steps = [...onset.keys()].sort((a, b) => a - b);
	if (!steps.length) return null;
	const fromStep = Math.floor((steps[0] ?? 0) / STEPS_PER_BAR) * STEPS_PER_BAR;
	const maxStep = fromStep + opts.maxSec / sps;
	const minGap = opts.minGapSec / sps;
	const lead = opts.leadSec / sps;
	const picked: { step: number; pitch: number }[] = [];
	for (const st of steps) {
		if (st - fromStep < lead || st > maxStep) continue;
		const prev = picked[picked.length - 1];
		if (prev && st - prev.step < minGap) continue;
		picked.push({ step: st, pitch: onset.get(st) ?? 0 });
	}
	if (!picked.length) return null;
	// 4つの 道の しきい（高さの 4分位）
	const sorted = picked.map((p) => p.pitch).sort((a, b) => a - b);
	const cut = (q: number) => sorted[Math.floor(sorted.length * q)] ?? 0;
	const edges = Array.from({ length: opts.lanes - 1 }, (_, i) =>
		cut((i + 1) / opts.lanes),
	);
	const notes: ChartNote[] = [];
	let lastLane = -1;
	let lastPitch = Number.NaN;
	for (const p of picked) {
		let lane: number;
		if (opts.taiko) {
			// 0＝ドン、1＝カッ（裏拍と、表でも 大きく 跳ね上がった 音は カッ）
			lane =
				p.step % STEPS_PER_BEAT !== 0 || p.pitch - lastPitch >= KA_LEAP ? 1 : 0;
		} else {
			lane = edges.filter((e) => p.pitch >= e && e > (sorted[0] ?? 0)).length;
			// 同じ 高さは 同じ 道、高さが かわったのに 同じ 道なら となりへ
			if (p.pitch === lastPitch && lastLane >= 0) lane = lastLane;
			else if (lane === lastLane && lastLane >= 0) {
				const dir = p.pitch > lastPitch ? 1 : -1;
				const next = lane + dir;
				lane = next >= 0 && next < opts.lanes ? next : lane - dir;
			}
		}
		notes.push({ at: (p.step - fromStep) * sps, lane });
		lastLane = lane;
		lastPitch = p.pitch;
	}
	const lastStep = picked[picked.length - 1]?.step ?? fromStep;
	const endStep =
		(Math.floor((lastStep - fromStep) / STEPS_PER_BAR) + 1) * STEPS_PER_BAR;
	return { fromStep, sps, notes, endSec: endStep * sps };
};

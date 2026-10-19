// 曲の コード進行（ラジカセの 窓の 札：ui/village/jukebox.ts）。
// MML の 音（@onjmin/dtm の parseMML）から @onjmin/chord-parser の detectProgression で 推定する
// （うんJレゼの MV と 同じ 手順：unj-reze lib/mv/mv-engine.ts の detectChordProgression）。
// 手で 書いた 進行は 持たない。曲ごとに 1度だけ 数えて 覚える。

/** 1小節の ステップ（dtm）。 */
const STEPS_PER_BAR = 192;

/** 進行の 1つ（bar は その コードが 鳴りはじめる 小節。小数）。 */
export type ChordStep = { bar: number; label: string };

const cache = new Map<string, Promise<ChordStep[]>>();

const detect = async (mml: string): Promise<ChordStep[]> => {
	try {
		const [dtm, cp] = await Promise.all([
			import("@onjmin/dtm"),
			import("@onjmin/chord-parser"),
		]);
		const parsed = dtm.parseMML(dtm.stripCustomVocals(mml));
		const bpm = parsed.bpm ?? 120;
		const secPerBar = (4 * 60) / bpm;
		const notes = parsed.placements.map((p) => ({
			pitch: p.pitchUnits / dtm.UNITS_PER_SEMITONE,
			when: (p.startStep / STEPS_PER_BAR) * secPerBar,
			duration: (Math.max(1, p.durationSteps) / STEPS_PER_BAR) * secPerBar,
		}));
		if (!notes.length) return [];
		return cp
			.detectProgression(notes, { bpm })
			.chords.map((c) => ({
				bar: Math.round((c.when / secPerBar) * 100) / 100,
				label: c.symbol,
			}))
			.sort((a, b) => a.bar - b.bar);
	} catch (e) {
		console.warn("[chords] コード進行を 数えられませんでした", e);
		return [];
	}
};

/** 曲（MML の 字）の コード進行。数えられなければ 空。 */
export const songChords = (mml: string): Promise<ChordStep[]> => {
	let p = cache.get(mml);
	if (!p) {
		p = detect(mml);
		cache.set(mml, p);
	}
	return p;
};

/** bar 小節目に 鳴って いる コードの 番号（まだ 何も 鳴って いなければ -1）。 */
export const chordIndexAt = (
	chords: readonly ChordStep[],
	bar: number,
): number => {
	let i = -1;
	for (let k = 0; k < chords.length && chords[k].bar <= bar; k++) i = k;
	return i;
};

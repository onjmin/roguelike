// 音ゲーの 譜面（BGM の 旋律から。data/arcade/songChart.ts）と 太鼓の 試験。

import { RH, rhStart, rhStep } from "../../data/arcade/logic";
import {
	BEAT_OPTS,
	melodyTrack,
	type SongNote,
	songChart,
	TAIKO_OPTS,
} from "../../data/arcade/songChart";
import { type HomeGameTest, ok } from "./kit";

/** 4分で 上がって 下がる 旋律（@0）と、伴奏（@1）。120 BPM（1拍 0.5秒）。 */
const SONG: SongNote[] = [
	...Array.from({ length: 64 }, (_, i) => ({
		trackIndex: 0,
		startStep: 192 * 2 + i * 48,
		durationSteps: 24,
		pitchUnits: 1800 + (i % 8 < 4 ? i % 8 : 8 - (i % 8)) * 62,
	})),
	...Array.from({ length: 40 }, (_, i) => ({
		trackIndex: 1,
		startStep: i * 96,
		durationSteps: 96,
		pitchUnits: 1500,
	})),
];

export const tests: HomeGameTest[] = [
	{
		name: "音ゲーの 譜面: 旋律（@0）から 作り、小節の 頭から 鳴らす・はじめの 間は 札を 出さない",
		run: () => {
			ok(melodyTrack(SONG) === 0, "melody is @0");
			const c = songChart(SONG, 120, BEAT_OPTS);
			if (!c) throw new Error("no chart");
			ok(c.fromStep === 384, `from ${c.fromStep}`);
			ok(
				c.notes.every((n) => n.at >= BEAT_OPTS.leadSec - 1e-9),
				"lead",
			);
			ok(c.notes.length >= 60, `notes ${c.notes.length}`);
			for (let l = 0; l < 4; l++)
				ok(
					c.notes.some((n) => n.lane === l),
					`lane ${l} used`,
				);
			ok(c.endSec >= (c.notes.at(-1)?.at ?? 0), "end after the last note");
			// 上がる 音は 右へ（同じ 道に 続けない）
			for (let i = 1; i < c.notes.length; i++)
				ok(c.notes[i]?.lane !== c.notes[i - 1]?.lane, `jack at ${i}`);
		},
	},
	{
		name: "音ゲーの 譜面: 速すぎる 音は 間引き、太鼓は ドンと カッが まざる・ぜんぶ 当てると フルコンボ",
		run: () => {
			const fast: SongNote[] = Array.from({ length: 200 }, (_, i) => ({
				trackIndex: 0,
				startStep: i * 12,
				durationSteps: 12,
				pitchUnits: 1800 + (i % 5) * 40,
			}));
			const c = songChart(fast, 150, BEAT_OPTS);
			if (!c) throw new Error("no chart");
			for (let i = 1; i < c.notes.length; i++)
				ok(
					(c.notes[i]?.at ?? 0) - (c.notes[i - 1]?.at ?? 0) >=
						BEAT_OPTS.minGapSec - 1e-9,
					"gap",
				);
			const t = songChart(fast, 150, TAIKO_OPTS);
			if (!t) throw new Error("no taiko chart");
			ok(
				t.notes.some((n) => n.lane === 0),
				"don",
			);
			ok(
				t.notes.some((n) => n.lane === 1),
				"ka",
			);
			ok(
				t.notes.every((n) => n.lane === 0 || n.lane === 1),
				"2 kinds",
			);
			// 太鼓も 音ゲーと 同じ 判定（道 0 が ドン、1 が カッ）
			const s = rhStart(t);
			const dt = 1 / 60;
			while (!s.over) {
				const hits = s.notes
					.filter((n) => !n.judged && n.at >= s.t && n.at < s.t + dt)
					.map((n) => ({ lane: n.lane, at: n.at }));
				rhStep(s, dt, hits);
			}
			ok(s.counts.miss === 0, `miss ${s.counts.miss}`);
			ok(s.score === t.notes.length * 100 + RH.fullCombo, `score ${s.score}`);
		},
	},
];

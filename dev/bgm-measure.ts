// BGM の大きさ（ラウドネス）を測る（開発用。pnpm dev で /dev/bgm.html）。
//
// ゲームと同じ形（dtm studio・マスター 100・既定の BGM 音量 40 ＝ #volume の 2 割）で 1 周鳴らし、
// studio の最終出力（startWavRecording）を録って、BS.1770 の I（ゲート付きの平均。LUFS）を出す。
// 目標（data/bgm.ts）に合わせた #volume も出す：新しい #volume = 今の #volume × 10^((目標 − I) / 20)。
// 等速で鳴らすので、曲の長さだけ時間がかかる（前奏のある曲は 前奏も入る。1 周＝ループなしで最後まで）。
// 「全曲」は 1 曲ずつ 続けて 測る（30 分ほど）。同時に 鳴らすと studio を 分けても 4 dB ほど 大きく 出るので 使えない。
// NO_HMR=1 の サーバーで 開くと、ほかの 編集で ページが 読み直されない。
// 音の出るページなので、最初は ボタンを押して始める（ブラウザの自動再生の決まり）。

import { createDtmStudio, type DtmStudio } from "@onjmin/dtm";
import { bgm } from "../src/data/bgm";

/** 目標（既定の BGM 音量で）。sad・ending は静かな曲なので -24。 */
const targetFor = (name: string): number =>
	name === "sad" || name === "ending" ? -24 : -23;

const songVolume = (mml: string): number =>
	Number(/#volume=(\d+)/.exec(mml)?.[1] ?? 50);

// ───────────────── BS.1770（K 特性・ゲート） ─────────────────

type Biquad = { b: number[]; a: number[] };

const kWeighting = (fs: number): Biquad[] => {
	// 高域の棚（頭の影響）
	let f0 = 1681.974450955533;
	const G = 3.999843853973347;
	let Q = 0.7071752369554196;
	let K = Math.tan((Math.PI * f0) / fs);
	const Vh = 10 ** (G / 20);
	const Vb = Vh ** 0.4996667741545416;
	let a0 = 1 + K / Q + K * K;
	const shelf: Biquad = {
		b: [
			(Vh + (Vb * K) / Q + K * K) / a0,
			(2 * (K * K - Vh)) / a0,
			(Vh - (Vb * K) / Q + K * K) / a0,
		],
		a: [1, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0],
	};
	// 低域を切る（RLB）
	f0 = 38.13547087602444;
	Q = 0.5003270373238773;
	K = Math.tan((Math.PI * f0) / fs);
	a0 = 1 + K / Q + K * K;
	const hp: Biquad = {
		b: [1, -2, 1],
		a: [1, (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0],
	};
	return [shelf, hp];
};

const filter = (x: Float32Array, f: Biquad): Float32Array => {
	const y = new Float32Array(x.length);
	let x1 = 0;
	let x2 = 0;
	let y1 = 0;
	let y2 = 0;
	for (let i = 0; i < x.length; i++) {
		const v =
			f.b[0] * x[i] + f.b[1] * x1 + f.b[2] * x2 - f.a[1] * y1 - f.a[2] * y2;
		x2 = x1;
		x1 = x[i];
		y2 = y1;
		y1 = v;
		y[i] = v;
	}
	return y;
};

/** 積分ラウドネス I（LUFS）と M-max。 */
const loudness = (
	chans: Float32Array[],
	fs: number,
): { I: number; mMax: number } => {
	const kw = kWeighting(fs);
	const w = chans.map((c) => kw.reduce((acc, f) => filter(acc, f), c));
	const block = Math.round(fs * 0.4);
	const hop = Math.round(fs * 0.1);
	const z: number[] = [];
	for (let s = 0; s + block <= w[0].length; s += hop) {
		let sum = 0;
		for (const c of w) {
			let e = 0;
			for (let i = s; i < s + block; i++) e += c[i] * c[i];
			sum += e / block;
		}
		z.push(sum);
	}
	const lk = (v: number) => -0.691 + 10 * Math.log10(v);
	const abs = z.filter((v) => lk(v) > -70);
	if (!abs.length) return { I: -Infinity, mMax: -Infinity };
	const mean = (a: number[]) => a.reduce((p, v) => p + v, 0) / a.length;
	const rel = lk(mean(abs)) - 10;
	const gated = abs.filter((v) => lk(v) > rel);
	return { I: lk(mean(gated)), mMax: lk(Math.max(...z)) };
};

/** 16bit PCM の WAV（stopWavRecording の Blob）を チャンネルごとの Float32 に。 */
const decodeWav = async (
	blob: Blob,
): Promise<{ chans: Float32Array[]; fs: number }> => {
	const buf = new DataView(await blob.arrayBuffer());
	let p = 12;
	let fs = 48000;
	let ch = 2;
	while (p + 8 <= buf.byteLength) {
		const id = String.fromCharCode(
			buf.getUint8(p),
			buf.getUint8(p + 1),
			buf.getUint8(p + 2),
			buf.getUint8(p + 3),
		);
		const len = buf.getUint32(p + 4, true);
		if (id === "fmt ") {
			ch = buf.getUint16(p + 10, true);
			fs = buf.getUint32(p + 12, true);
		} else if (id === "data") {
			const n = Math.floor(len / 2 / ch);
			const chans = Array.from({ length: ch }, () => new Float32Array(n));
			for (let i = 0; i < n; i++)
				for (let c = 0; c < ch; c++)
					chans[c][i] = buf.getInt16(p + 8 + (i * ch + c) * 2, true) / 32768;
			return { chans, fs };
		}
		p += 8 + len + (len % 2);
	}
	throw new Error("WAV が読めません");
};

// ───────────────── 画面 ─────────────────

const out = document.getElementById("out") as HTMLElement;
const log = (s: string) => {
	out.textContent += `${s}
`;
};

/** 曲ごとに 自分の AudioContext と studio を 作る（同時に 鳴らしても 録音は まざらない）。 */
const newStudio = async (): Promise<DtmStudio> => {
	const ctx = new AudioContext();
	await ctx.resume();
	return createDtmStudio({
		audioContext: ctx,
		masterVolume: 100,
		voiceWorkerUrl: null,
		features: { midi: false, chord: false, presetUI: false, help: false },
	});
};

let single: DtmStudio | null = null;

const measure = async (name: string, studio?: DtmStudio): Promise<void> => {
	const mml = bgm[name];
	single ??= studio ? null : await newStudio();
	const s = studio ?? (single as DtmStudio);
	const vol = songVolume(mml);
	log(`${name}: #volume=${vol} を鳴らしています（1 周）…`);
	await new Promise<void>((done) => {
		s.startWavRecording();
		// ゲームと同じく 見えていなくても 止めない（測るあいだ ほかの窓を見ていてよい）
		const pb = s.play(mml, {
			loop: false,
			onStop: () => done(),
			pauseWhenHidden: false,
		});
		pb.setVolume(vol * 0.4 * 0.5);
	});
	const wav = await s.stopWavRecording();
	const { chans, fs } = await decodeWav(wav);
	const { I, mMax } = loudness(chans, fs);
	const target = targetFor(name);
	const next = Math.round(vol * 10 ** ((target - I) / 20));
	log(
		`  ${name}: I = ${I.toFixed(1)} LUFS（M-max ${mMax.toFixed(1)}）・${(chans[0].length / fs).toFixed(1)} 秒 → 目標 ${target} には #volume=${next}`,
	);
	(
		window as unknown as { __bgmResult: Record<string, unknown> }
	).__bgmResult ??= {};
	(window as unknown as { __bgmResult: Record<string, unknown> }).__bgmResult[
		name
	] = { I, mMax, vol, next, sec: chans[0].length / fs };
};

/** 全曲を 1曲ずつ 測る（同時に 鳴らすと dtm の 中で まざって 大きく 出るので 1曲ずつ）。 */
const measureAll = async (): Promise<void> => {
	const t0 = performance.now();
	for (const name of Object.keys(bgm)) await measure(name);
	log(`全曲 おわり（${((performance.now() - t0) / 1000).toFixed(0)} 秒）`);
};

const list = document.getElementById("list") as HTMLElement;
for (const name of Object.keys(bgm)) {
	const b = document.createElement("button");
	b.textContent = name;
	b.onclick = () => void measure(name);
	list.appendChild(b);
}
const all = document.createElement("button");
all.textContent = "全曲（1 曲ずつ）";
all.onclick = () => void measureAll();
list.appendChild(all);
(window as unknown as { __measure: typeof measure }).__measure = measure;
(window as unknown as { __measureAll: typeof measureAll }).__measureAll =
	measureAll;

// 音：BGM（MML を @onjmin/dtm で再生）・効果音（RPGEN の mp3）。
//
// - AudioContext は1つだけ。スマホの自動再生制限のため、最初のタップ／キー入力で作る（unlock）。
// - BGM と効果音は画面右上のボタンでまとめてミュートできる（settings.mute）。
//   ミュート中も「今どの曲のはずか」は覚えておき、解除したらその曲から鳴らす。
// - dtm のシーケンサは 0.5 秒以上止まる（タブ切替・画面ロック・重い処理）と黙って再生をやめる。
//   onStop で「自分で止めたのではない」停止を見分け、最後の位置から鳴らし直す。
// - dtm は重いので、最初の音が要るまで動的 import で遅らせる。
// - 大きさは測ったラウドネスでそろえる（data/loudness.ts）。既定の音量設定のとき、
//   BGM は曲ごとの #volume で、効果音は1音ずつの倍率で目標の大きさになる。
// - 効果音が鳴り始めたら、その音の本体が鳴り終わる時刻（waitMs。data/loudness.ts）まで「区切り待ち」にする。
//   次の行動・選択肢の決定などはそれまで効かない（seSettled / seHeld）。
//   連打で次の効果音が畳みかけて重ならないように。余韻までは待たせない。
// - ジングル（勝利の曲）は途中で絞って止められる（fadeOutJingle。レベルアップの音と重ねない）。
//   ループの BGM も絞って止められる（fadeBgm。階段を降りるとき）。
//   dtm の stop は先読みで予約済みの音符（約0.5秒ぶん）を鳴らし残すので、出口の音量ごと絞る。

import type { DtmStudio, MmlPlayback } from "@onjmin/dtm";
import {
	REF_VOLUME,
	SE_LOUDNESS,
	SE_UNMEASURED_GAIN,
	SE_WAIT,
} from "../data/loudness";
import { soundUrl } from "./assets";
import { onSettingsChange, settings } from "./settings";

type Dtm = typeof import("@onjmin/dtm");

let dtmPromise: Promise<Dtm> | null = null;
const loadDtm = (): Promise<Dtm> => {
	dtmPromise ??= import("@onjmin/dtm");
	return dtmPromise;
};

/** MML ヘッダの `#volume=` （曲ごとの音量。ラウドネスをそろえてある。data/bgm.ts）。 */
const songVolume = (mml: string): number => {
	const m = /#volume=(\d+)/.exec(mml);
	return m ? Number(m[1]) : 50;
};

/**
 * 効果音の全体の音量。既定（60）で 1 倍＝素材ごとの倍率（seLevel）だけで目標の大きさになる。
 * 最大（100）で +4.4 dB（直す前と同じ幅）。
 */
const seGainOf = (v: number): number => v / REF_VOLUME.se;
/** 効果音ごとの倍率（data/loudness.ts）。測っていない音は直す前と同じ大きさ。 */
const seLevel = (name: string): number =>
	SE_LOUDNESS[name]?.[4] ?? SE_UNMEASURED_GAIN;
/** これより長い効果音（ジングル）は、同じ音が鳴っている間は重ねない。 */
const LONG_SE_SEC = 1;
/** 読み込みにこれより長くかかった効果音は鳴らさない（ずれた音は邪魔）。 */
const SE_LATE_MS = 600;
/** 区切り待ちのいちばん長い時間（1回の待ちはこれを超えない）。 */
const SE_HOLD_MAX_MS = SE_WAIT.jingleMaxMs;
/** 効果音を鳴らしてから次へ進めるまでの ms（測っていない音は待たない）。 */
const seWaitMs = (name: string): number => SE_LOUDNESS[name]?.[7] ?? 0;

/** dtm studio の出口の音量（createDtmStudio の masterVolume）。 */
const STUDIO_MASTER_VOLUME = 100;
/**
 * 曲を絞って止めたあと、出口を外す（studio は戻す）までの秒数。止めても予約済みの音符
 * （先読み0.5秒＋長い音符・残響）は鳴り続けるので、それが消えるまで絞ったままにする。
 */
const DUCK_TAIL_SEC = 2;

/** AudioParam を今の値から sec 秒かけて v へ（先の予約は捨てる）。 */
const rampTo = (p: AudioParam, now: number, v: number, sec: number): void => {
	p.cancelScheduledValues(now);
	p.setValueAtTime(p.value, now);
	p.linearRampToValueAtTime(v, now + sec);
};

/** 曲の出口（軽量の音の bus）を、止めた音の残りが消えてから外す。 */
const releaseBus = (bus: GainNode): void => {
	setTimeout(() => bus.disconnect(), DUCK_TAIL_SEC * 1000);
};

const sleep = (ms: number): Promise<void> =>
	new Promise((r) => setTimeout(r, ms));

/**
 * 前奏（`@0` が全休符で始まる4小節）がある曲は、2周目から前奏を飛ばす。
 * 休符はオクターブ指定の前に書かれている（`;@0t155v100r1r1r1r1o4…`）ので、o は無くてもよい。
 */
const hasIntro = (mml: string): boolean =>
	/@0\s*t\d+\s*v\d+\s*(?:o\d\s*)?r1r1r1r1/.test(mml);

export class GameAudio {
	private ctx: AudioContext | null = null;
	private seGain: GainNode | null = null;
	private studioPromise: Promise<DtmStudio> | null = null;
	private bgmData: Record<string, string>;
	private sfxData: Record<string, string>;
	/** 鳴っている（はずの）曲名。 */
	private bgmName: string | null = null;
	private bgmPlayback: MmlPlayback | null = null;
	/** ループの曲の出口（軽量の音だけ。fadeBgm で絞る。高音質は studio の出口を絞る）。 */
	private bgmBus: GainNode | null = null;
	/** 再生を始めるたびに増える。古い再生の onStop などを見分ける。 */
	private bgmToken = 0;
	/** 最後に鳴らした位置（1小節=192ステップ）。止まったときの再開用。 */
	private bgmLastStep = 0;
	/** 鳴っているジングル。軽量の音は自前の出口（bus）を通して絞れるようにする。 */
	private jingleNow: { pb: MmlPlayback; bus: GainNode | null } | null = null;
	/** 読み込み中・再生中のジングルの bgmToken（鳴り始める前に止める用）。 */
	private jingleToken = -1;
	/** studio の出口を絞っている間、戻してよくなる時刻（AudioContext の時計）。 */
	private duckUntil: number | null = null;
	private seCache = new Map<string, Promise<AudioBuffer | null>>();
	/** 長い効果音が鳴り終わる時刻（AudioContext の時計。重ね鳴らし防止）。 */
	private seEnds = new Map<string, number>();
	/** 区切り待ちが終わる時刻（performance.now の時計）。 */
	private holdUntil = 0;
	/**
	 * 読み込み中の効果音と、鳴るか捨てるか決まる時刻（初めての音はまだ鳴っていないが、
	 * すぐ鳴って待ちが始まるので、その間も進めない）。
	 */
	private sePending = new Set<{ until: number }>();

	constructor(bgm: Record<string, string>, sfx: Record<string, string>) {
		this.bgmData = bgm;
		this.sfxData = sfx;
		let prev = {
			bgm: settings.bgm,
			mute: settings.mute,
			bgmVolume: settings.bgmVolume,
		};
		onSettingsChange(() => {
			const cur = {
				bgm: settings.bgm,
				mute: settings.mute,
				bgmVolume: settings.bgmVolume,
			};
			if (cur.bgm !== prev.bgm || cur.mute !== prev.mute) {
				this.restartBgm(0);
			} else if (
				cur.bgmVolume !== prev.bgmVolume &&
				this.bgmPlayback &&
				this.bgmName
			) {
				this.bgmPlayback.setVolume(
					this.volumeFor(this.bgmData[this.bgmName] ?? ""),
				);
			}
			if (this.seGain) this.seGain.gain.value = seGainOf(settings.seVolume);
			// 音を消したら、鳴っていた音の区切りも待たない
			if (!this.seAudible()) {
				this.holdUntil = 0;
				this.sePending.clear();
			}
			prev = cur;
		});
		document.addEventListener("visibilitychange", () => this.onVisibility());
	}

	/** 最初のユーザー操作（のコールスタック内）で呼ぶ。以後は何度呼んでもよい。 */
	unlock(): void {
		if (!this.ctx) {
			// iOS: 既定のままだとマナーモードで Web Audio が無音になる。ctx を作る前に設定する。
			// （音を消したい人は右上のミュートボタンで消せる）
			const nav = navigator as Navigator & { audioSession?: { type: string } };
			try {
				if (nav.audioSession) nav.audioSession.type = "playback";
			} catch {
				// 対応していないブラウザ
			}
			const AC =
				window.AudioContext ??
				(window as unknown as { webkitAudioContext: typeof AudioContext })
					.webkitAudioContext;
			this.ctx = new AC({ latencyHint: "interactive" });
			this.seGain = this.ctx.createGain();
			this.seGain.gain.value = seGainOf(settings.seVolume);
			this.seGain.connect(this.ctx.destination);
			// 鳴らすはずだった曲があれば始める
			if (this.bgmName) this.restartBgm(0);
		}
		const ctx = this.ctx;
		if (ctx.state === "suspended") void ctx.resume();
		// 古い iOS 向け：無音を1サンプル鳴らして出力を開く
		const src = ctx.createBufferSource();
		src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
		src.connect(ctx.destination);
		src.start();
	}

	get unlocked(): boolean {
		return this.ctx !== null;
	}

	/** 鳴っている（はずの）曲名。 */
	get currentBgm(): string | null {
		return this.bgmName;
	}

	private studio(): Promise<DtmStudio> {
		const ctx = this.ctx;
		if (!ctx) return Promise.reject(new Error("audio locked"));
		if (!this.studioPromise) {
			this.studioPromise = loadDtm().then((dtm) =>
				dtm.createDtmStudio({
					audioContext: ctx,
					masterVolume: STUDIO_MASTER_VOLUME,
					// 歌声合成は使わない（ワーカーを立てない）
					voiceWorkerUrl: null,
					features: { midi: false, chord: false, presetUI: false, help: false },
				}),
			);
			this.studioPromise.catch(() => {
				this.studioPromise = null; // 次に要るときにやり直す
			});
		}
		return this.studioPromise;
	}

	private onVisibility(): void {
		const ctx = this.ctx;
		if (!ctx) return;
		if (document.visibilityState === "hidden") {
			void ctx.suspend();
			return;
		}
		void ctx.resume();
		// 隠れている間に停滞検知で止まっていたら、続きから鳴らす
		if (this.bgmName && this.canPlayBgm() && !this.bgmPlayback?.isPlaying()) {
			this.restartBgm(this.bgmLastStep);
		}
	}

	// ───────────────── BGM ─────────────────

	private volumeFor(mml: string): number {
		// 曲ごとの #volume に設定の音量を掛ける（既定 40 で #volume の 2 割、100 で半分）。
		// #volume は既定の 40 で -23 LUFS（sad・ending は -24）になるよう、測って直してある。
		return Math.min(100, songVolume(mml) * (settings.bgmVolume / 100) * 0.5);
	}

	/**
	 * 曲を切り替える。同じ曲なら続けて鳴らす。null で止める。
	 * fadeBgm・fadeOutJingle で絞った出口は、次に鳴らすときに戻す。
	 */
	bgm(name: string | null): void {
		if (
			name === this.bgmName &&
			(this.bgmPlayback?.isPlaying() || !this.canPlayBgm())
		)
			return;
		this.bgmName = name;
		this.restartBgm(0);
	}

	/**
	 * 鳴っているループの曲を ms かけて絞って止める（階段を降りるとき）。終わったら解決。
	 * 止めた後は曲名も忘れるので、次の bgm() は同じ曲でも頭から鳴らす（音量も戻る）。
	 * ジングルが鳴っていればそれを絞る（fadeOutJingle）。
	 */
	async fadeBgm(ms: number): Promise<void> {
		const j = this.jingleNow;
		if (
			(j && j.pb === this.bgmPlayback) ||
			this.jingleToken === this.bgmToken
		) {
			await this.fadeOutJingle(ms);
			return;
		}
		const pb = this.bgmPlayback;
		const ctx = this.ctx;
		// 曲名を先に消す（絞っている間に停滞検知・画面の復帰で鳴らし直さないように）
		this.bgmName = null;
		if (!pb || !ctx || ms <= 0) {
			// 読み込み中なら鳴らさずに捨てる
			this.stopBgmPlayback();
			return;
		}
		const sec = ms / 1000;
		const bus = this.bgmBus;
		if (bus) {
			rampTo(bus.gain, ctx.currentTime, 0, sec);
		} else {
			// 高音質は studio の出口を絞る。次に studio で鳴らすときに戻す（unduck）
			const studio = await this.studioPromise?.catch(() => null);
			if (studio) {
				rampTo(studio.masterGain.gain, ctx.currentTime, 0, sec);
				this.duckUntil = ctx.currentTime + sec + DUCK_TAIL_SEC;
			}
		}
		await sleep(ms);
		// ほかの曲に替わっていたら、替えた側がもう止めている
		if (this.bgmPlayback === pb) this.stopBgmPlayback();
	}

	/** 短い曲（ジングル）を1回だけ鳴らす。終わったら解決。BGM は止める。 */
	async jingle(name: string, fromBar = 1, maxMs = 8000): Promise<void> {
		this.stopBgmPlayback();
		this.bgmName = null;
		const mml = this.bgmData[name];
		const ctx = this.ctx;
		if (!mml || !ctx || !this.canPlayBgm()) return;
		const token = ++this.bgmToken;
		this.jingleToken = token;
		// 軽量の音は自前の出口を通す（途中で絞れるように。高音質は studio の出口を絞る）
		const bus = settings.bgm === "hq" ? null : ctx.createGain();
		bus?.connect(ctx.destination);
		const pb = await this.startMml(
			mml,
			false,
			(fromBar - 1) * 192,
			token,
			bus ?? undefined,
		);
		if (!pb || token !== this.bgmToken) {
			if (pb) this.dispose(pb);
			bus?.disconnect();
			if (this.jingleToken === token) this.jingleToken = -1;
			return;
		}
		this.bgmPlayback = pb;
		const entry = { pb, bus };
		this.jingleNow = entry;
		// 勝利のジングルも効果音と同じく区切り待ちにする（続けてレベルアップの音が重ならないように）。
		// 曲の長さは測っていないので、ジングルの上限（1.5 秒）だけ待つ
		this.hold(SE_HOLD_MAX_MS);
		const start = performance.now();
		while (pb.isPlaying() && performance.now() - start < maxMs) {
			await sleep(100);
		}
		if (this.jingleNow === entry) {
			this.jingleNow = null;
			// 余韻を切らないよう、少し置いてから出口を外す
			if (bus) releaseBus(bus);
		}
		if (this.jingleToken === token) this.jingleToken = -1;
		if (this.bgmPlayback === pb) this.stopBgmPlayback();
	}

	/**
	 * 鳴っているジングルを ms かけて絞って止める（勝利の曲にレベルアップの音を重ねない）。
	 * 読み込み中でまだ鳴っていなければ、鳴らさずに捨てる。ジングルでなければ何もしない。
	 */
	async fadeOutJingle(ms = 150): Promise<void> {
		const j = this.jingleNow;
		const ctx = this.ctx;
		if (!j || j.pb !== this.bgmPlayback || !ctx) {
			if (this.jingleToken === this.bgmToken) this.stopBgmPlayback();
			return;
		}
		this.jingleNow = null;
		const sec = ms / 1000;
		if (j.bus) {
			rampTo(j.bus.gain, ctx.currentTime, 0, sec);
		} else {
			// 高音質は studio の出口を絞る。次に studio で鳴らすときに戻す（unduck）
			const studio = await this.studioPromise?.catch(() => null);
			if (studio) {
				rampTo(studio.masterGain.gain, ctx.currentTime, 0, sec);
				this.duckUntil = ctx.currentTime + sec + DUCK_TAIL_SEC;
			}
		}
		await sleep(ms);
		// ほかの曲に替わっていたら、替えた側がもう止めている
		if (this.bgmPlayback === j.pb) this.stopBgmPlayback();
		if (j.bus) releaseBus(j.bus);
	}

	/** fadeBgm・fadeOutJingle で絞った studio の出口を、絞った音の残りが消えてから戻す。 */
	private unduck(studio: DtmStudio): void {
		const ctx = this.ctx;
		if (this.duckUntil === null || !ctx) return;
		const at = Math.max(ctx.currentTime, this.duckUntil);
		this.duckUntil = null;
		const g = studio.masterGain.gain;
		g.cancelScheduledValues(at);
		g.setValueAtTime(0, at);
		g.linearRampToValueAtTime(STUDIO_MASTER_VOLUME / 100, at + 0.05);
	}

	private canPlayBgm(): boolean {
		return !!this.ctx && !settings.mute && settings.bgm !== "off";
	}

	private dispose(pb: MmlPlayback): void {
		try {
			pb.stop();
			pb.destroy(); // 渡した ctx は閉じない
		} catch {
			// 止め損ねても続行
		}
	}

	private stopBgmPlayback(): void {
		this.bgmToken++;
		const pb = this.bgmPlayback;
		this.bgmPlayback = null;
		if (pb) this.dispose(pb);
		const bus = this.bgmBus;
		this.bgmBus = null;
		if (bus) releaseBus(bus);
	}

	private restartBgm(fromStep: number): void {
		this.stopBgmPlayback();
		const token = this.bgmToken;
		const name = this.bgmName;
		const ctx = this.ctx;
		this.bgmLastStep = fromStep;
		if (!name || !ctx || !this.canPlayBgm()) return;
		const mml = this.bgmData[name];
		if (!mml) {
			console.warn(`[audio] BGM ${name} がありません`);
			return;
		}
		// 軽量の音は自前の出口を通す（fadeBgm で絞れるように）
		const bus = settings.bgm === "hq" ? null : ctx.createGain();
		bus?.connect(ctx.destination);
		void this.startMml(
			mml,
			true,
			fromStep || undefined,
			token,
			bus ?? undefined,
		).then((pb) => {
			if (!pb || token !== this.bgmToken) {
				if (pb) this.dispose(pb);
				if (bus) releaseBus(bus);
				return;
			}
			this.bgmPlayback = pb;
			this.bgmBus = bus;
		});
	}

	/** destination は軽量の音の出口（省略で ctx.destination）。 */
	private async startMml(
		mml: string,
		loop: boolean,
		startStep: number | undefined,
		token: number,
		destination?: AudioNode,
	): Promise<MmlPlayback | null> {
		const ctx = this.ctx;
		if (!ctx) return null;
		const loopOpt = loop
			? hasIntro(mml)
				? { start: { bar: 5 } }
				: true
			: false;
		const volume = this.volumeFor(mml);
		const onTick = (step: number) => {
			if (token === this.bgmToken) this.bgmLastStep = step;
		};
		// 自分で止めていないのに止まった = 停滞検知。見えていれば続きから鳴らし直す
		const onStop = () => {
			if (!loop || token !== this.bgmToken || !this.bgmName) return;
			if (document.visibilityState === "visible")
				this.restartBgm(this.bgmLastStep);
		};
		const common = {
			loop: loopOpt,
			startStep,
			onTick,
			onStop,
			pauseWhenHidden: false,
		};
		try {
			if (settings.bgm === "hq") {
				const studio = await this.studio();
				// 絞った出口が戻るまで待ってから鳴らす（曲の頭が絞ったまま消えないように）
				const wait =
					this.duckUntil === null ? 0 : this.duckUntil - ctx.currentTime;
				if (wait > 0) {
					await sleep(wait * 1000);
					if (token !== this.bgmToken) return null;
				}
				this.unduck(studio);
				const pb = studio.play(mml, common);
				pb.setVolume(volume);
				return pb;
			}
			const dtm = await loadDtm();
			const pb = dtm.playMML(mml, {
				...common,
				audioContext: ctx,
				destination: destination ?? ctx.destination,
			});
			pb.setVolume(volume);
			return pb;
		} catch (e) {
			console.warn("[audio] BGM を鳴らせませんでした", e);
			return null;
		}
	}

	// ───────────────── 効果音 ─────────────────

	private buffer(name: string): Promise<AudioBuffer | null> | null {
		const ctx = this.ctx;
		const ref = this.sfxData[name];
		if (!ctx || !ref) return null;
		let p = this.seCache.get(name);
		if (!p) {
			const url = ref.startsWith("rpgen:") ? soundUrl(ref.slice(6)) : ref;
			p = fetch(url)
				.then((r) =>
					r.ok ? r.arrayBuffer() : Promise.reject(new Error(`${r.status}`)),
				)
				.then((b) => ctx.decodeAudioData(b))
				.catch((e) => {
					console.warn(`[audio] 効果音 ${name} を読めませんでした`, e);
					return null;
				});
			this.seCache.set(name, p);
		}
		return p;
	}

	/** 効果音をあらかじめ読み込む（最初の1回の遅れを無くす）。unlock の後に呼ぶ。 */
	preloadSe(names: string[]): void {
		for (const n of names) void this.buffer(n);
	}

	/** 効果音が聞こえる設定か（ミュート・音量 0 のときは鳴らさず、区切りも待たない）。 */
	private seAudible(): boolean {
		return !settings.mute && settings.seVolume > 0;
	}

	se(name: string): void {
		if (!this.seAudible() || !this.ctx || !this.seGain) return;
		const ctx = this.ctx;
		const gain = this.seGain;
		const p = this.buffer(name);
		if (!p) return;
		const t0 = performance.now();
		const pending = { until: t0 + SE_LATE_MS };
		this.sePending.add(pending);
		void p.then((buf) => {
			this.sePending.delete(pending);
			// 読み込みに時間がかかりすぎたら鳴らさない（ずれた音は邪魔）
			if (!buf || performance.now() - t0 > SE_LATE_MS) return;
			if (!this.seAudible()) return; // 読み込み中に消された
			// ジングルのような長い音は、同じ音が鳴り終わるまで重ねない（カーソル音などの短い音は重ねてよい）
			if (buf.duration > LONG_SE_SEC) {
				if ((this.seEnds.get(name) ?? 0) > ctx.currentTime) return;
				this.seEnds.set(name, ctx.currentTime + buf.duration);
			}
			const src = ctx.createBufferSource();
			src.buffer = buf;
			// 素材ごとの大きさの補正 → 全体の音量
			const level = ctx.createGain();
			level.gain.value = seLevel(name);
			src.connect(level).connect(gain);
			src.onended = () => level.disconnect();
			src.start();
			// 実際に鳴り始めた音だけ、本体が鳴り終わるまで次へ進めない
			this.hold(seWaitMs(name));
		});
	}

	/** 今から ms の間を区切り待ちにする（前の待ちが長ければそちら）。 */
	private hold(ms: number): void {
		if (ms <= 0) return;
		this.holdUntil = Math.max(
			this.holdUntil,
			performance.now() + Math.min(ms, SE_HOLD_MAX_MS),
		);
	}

	/** 効果音の区切り待ちの最中か（鳴らしたばかりの音の本体がまだ鳴っている・読み込み中）。 */
	get seHeld(): boolean {
		const now = performance.now();
		if (now < this.holdUntil) return true;
		for (const p of this.sePending) {
			if (p.until > now) return true;
			this.sePending.delete(p); // 読み込みが止まったままの音は待たない
		}
		return false;
	}

	/**
	 * 効果音の区切りまで待つ。待ちの間に次の音が鳴れば延びるが、呼んでから
	 * SE_HOLD_MAX_MS を超えては待たない（時計で決めるので、タブが隠れていても抜ける）。
	 */
	async seSettled(): Promise<void> {
		const limit = performance.now() + SE_HOLD_MAX_MS;
		// 読み込み済みの音は次のマイクロタスクで鳴り始めて待ちが決まるので、先にそれを済ませる
		await Promise.resolve();
		while (this.seHeld) {
			const rest = limit - performance.now();
			if (rest <= 0) return;
			await sleep(Math.min(rest, 30));
		}
	}

	/** 効果音の鳴り始めと鳴り終わり（ms。頭の無音を含むファイルの中の位置）。測っていなければ null。 */
	seSpan(name: string): { startMs: number; endMs: number } | null {
		const m = SE_LOUDNESS[name];
		return m ? { startMs: m[5], endMs: m[6] } : null;
	}
}

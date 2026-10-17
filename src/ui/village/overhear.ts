// 立ち聞きの 吹き出し（文は data/village/overhear.ts）。キリコの 近くに いる 住人の 独り言か、
// 通行人どうしの 掛け合いを 頭の 上に 1つずつ 出す。窓を 開かず、キリコも 止めない。
// 窓が 開いて いる あいだ（話しかけた・場面）は 出さず、出て いた ものは 消す。
// 同じ 掛け合いは、ほかを ぜんぶ 聞くまで くり返さない（村に いる あいだだけ 覚える）。

import type { MobId } from "../../data/people/mobs";
import {
	CROWD_MUTTERS,
	CROWD_PAIRS,
	MOB_MUTTERS,
	type Overheard,
} from "../../data/village/overhear";
import type { Actor } from "../../engine/field";
import { TILE } from "../../engine/types";

/** キリコから これだけ（マス。たて・よこ・ななめの 大きい方）の 人だけ 話す。 */
export const HEAR = 4;
/** 掛け合いの 途中で 人が これより 離れたら やめる。 */
const LOST = HEAR + 3;
/** 通行人どうしが これだけ 近ければ 掛け合う。 */
const PAIR = 2;
/** 掛け合いに 入らない 通行人（口調が あわない）。 */
const PAIR_OUT = ["elder", "dajare"];
/** 村に 入ってから 最初の 吹き出しまで（ms）。 */
const FIRST_MS = 2500;
/** 掛け合いの あと 次までの 間（ms。この あいだで ばらつく）。 */
const GAP_MS: readonly [number, number] = [6000, 11000];
/** 1つの 吹き出しが 出て いる 長さ（ms）：BASE + 1字ごとに PER_CHAR。 */
const BASE_MS = 1200;
const PER_CHAR_MS = 110;
/** 吹き出しの あいだの 間（ms）。 */
const BETWEEN_MS = 250;
const FADE_MS = 150;

export type OverhearHost = {
	/** いまの 地図の 人（キリコは 入らない）。 */
	actors: () => readonly Actor[];
	player: () => Actor;
	/** 通行人（いれば）。 */
	walkers: () => readonly { actor: Actor; persona: string }[];
	/** 窓が 開いている・場面の 最中・村を 出る。 */
	paused: () => boolean;
	rng?: () => number;
};

type Line = { actor: Actor; text: string };

const isMobId = (id: string): id is MobId => id in MOB_MUTTERS;

const dist = (a: Actor, b: Actor): number =>
	Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

export class Overhear {
	private wait = FIRST_MS;
	private queue: Line[] = [];
	private cast: Actor[] = [];
	private shown: (Line & { t: number; ms: number }) | null = null;
	private time = 0;
	private heard = new Set<string>();
	private readonly rng: () => number;

	constructor(private readonly h: OverhearHost) {
		this.rng = h.rng ?? Math.random;
	}

	/** 村に 入りなおした とき（地図が かわった）。 */
	reset(): void {
		this.stop();
		this.wait = FIRST_MS;
	}

	/** いま 出て いる 吹き出し（試し用）。 */
	get current(): { id: string; text: string } | null {
		return this.shown
			? { id: this.shown.actor.id, text: this.shown.text }
			: null;
	}

	private stop(): void {
		this.queue = [];
		this.cast = [];
		this.shown = null;
	}

	update(dt: number): void {
		this.time += dt;
		if (this.h.paused()) {
			if (this.shown || this.queue.length) this.stop();
			this.wait = Math.max(this.wait, 1500);
			return;
		}
		if (this.shown) {
			if (!this.present()) {
				this.stop();
				this.wait = this.gap();
				return;
			}
			if (this.time - this.shown.t < this.shown.ms + BETWEEN_MS) return;
			this.shown = null;
			if (!this.queue.length) {
				this.cast = [];
				this.wait = this.gap();
				return;
			}
		}
		const next = this.queue.shift();
		if (next) {
			this.show(next);
			return;
		}
		this.wait -= dt;
		if (this.wait > 0) return;
		if (!this.start()) this.wait = 1000;
	}

	private gap(): number {
		return GAP_MS[0] + this.rng() * (GAP_MS[1] - GAP_MS[0]);
	}

	private show(l: Line): void {
		const chars = [...l.text.replace(/\n/g, "")].length;
		this.shown = { ...l, t: this.time, ms: BASE_MS + chars * PER_CHAR_MS };
	}

	/** 話して いる 人が まだ 地図に いて、キリコから 離れて いない。 */
	private present(): boolean {
		const here = this.h.actors();
		return this.cast.every(
			(a) => a.visible && here.includes(a) && dist(a, this.h.player()) <= LOST,
		);
	}

	/** 近くの 人から 1つ 選んで はじめる（だれも いなければ false）。 */
	private start(): boolean {
		const me = this.h.player();
		const near = (a: Actor) => a.visible && dist(a, me) <= HEAR;
		const options: { who: Actor[]; talk: Overheard }[] = [];
		for (const a of this.h.actors()) {
			const id = a.id.startsWith("mob_") ? a.id.slice(4) : "";
			if (!isMobId(id) || !near(a)) continue;
			for (const talk of MOB_MUTTERS[id]) options.push({ who: [a], talk });
		}
		const peds = this.h.walkers().filter((w) => near(w.actor));
		for (const w of peds)
			for (const talk of CROWD_MUTTERS[w.persona] ?? [])
				options.push({ who: [w.actor], talk });
		const pairs = peds.filter((w) => !PAIR_OUT.includes(w.persona));
		for (const [i, a] of pairs.entries())
			for (const b of pairs.slice(i + 1))
				if (dist(a.actor, b.actor) <= PAIR)
					for (const talk of CROWD_PAIRS)
						options.push({ who: [a.actor, b.actor], talk });
		if (!options.length) return false;
		let fresh = options.filter((o) => !this.heard.has(o.talk.key));
		if (!fresh.length) {
			for (const o of options) this.heard.delete(o.talk.key);
			fresh = options;
		}
		const pick = fresh[Math.floor(this.rng() * fresh.length)] ?? fresh[0];
		if (!pick) return false;
		this.heard.add(pick.talk.key);
		this.cast = pick.who;
		const [a, b] = pick.who;
		// 掛け合う 2人は 向かい合う（歩いて いる 人は 歩く 向きの まま）
		if (a && b) {
			if (!a.moving) a.dir = faceTo(a, b);
			if (!b.moving) b.dir = faceTo(b, a);
		}
		this.queue = pick.talk.lines.flatMap((l) => {
			const actor = pick.who[l.by];
			return actor ? [{ actor, text: l.text }] : [];
		});
		const first = this.queue.shift();
		if (first) this.show(first);
		return true;
	}

	/** 頭の 上に 描く（ox・oy は カメラ、w は 画面の 幅。夜の 色の あとに 呼ぶ）。 */
	draw(g: CanvasRenderingContext2D, ox: number, oy: number, w: number): void {
		const s = this.shown;
		if (!s) return;
		const a = this.time - s.t;
		const alpha = Math.max(0, Math.min(1, a / FADE_MS, (s.ms - a) / FADE_MS));
		if (alpha <= 0) return;
		const lines = s.text.split("\n");
		g.save();
		g.globalAlpha = alpha;
		g.font = "8px 'DotGothic16', monospace";
		g.textBaseline = "top";
		const tw = Math.ceil(Math.max(...lines.map((l) => g.measureText(l).width)));
		const bw = tw + 6;
		const bh = lines.length * 9 + 3;
		const cx = Math.round(s.actor.fx * TILE - ox + TILE / 2);
		const tip = Math.round(s.actor.fy * TILE - oy - 1);
		const x0 = Math.max(1, Math.min(w - bw - 1, cx - Math.round(bw / 2)));
		const y0 = tip - 3 - bh;
		g.fillStyle = "#fffdf4";
		g.strokeStyle = "#2a2a33";
		g.lineWidth = 1;
		g.beginPath();
		g.roundRect(x0 + 0.5, y0 + 0.5, bw, bh, 2);
		g.fill();
		g.stroke();
		// しっぽ（話す 人の 頭へ）
		const tx = Math.max(x0 + 3, Math.min(x0 + bw - 3, cx));
		g.beginPath();
		g.moveTo(tx - 2.5, y0 + bh + 0.5);
		g.lineTo(tx + 0.5, tip);
		g.lineTo(tx + 3.5, y0 + bh + 0.5);
		g.fill();
		g.stroke();
		g.fillRect(tx - 2, y0 + bh - 1, 5, 2);
		g.fillStyle = "#2a2a33";
		lines.forEach((l, i) => {
			g.fillText(l, x0 + 3, y0 + 2 + i * 9);
		});
		g.restore();
	}
}

const faceTo = (a: Actor, b: Actor): Actor["dir"] => {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "right" : "left";
	return dy >= 0 ? "down" : "up";
};

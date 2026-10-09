// 街の 人通りを 動かす（流れと 行き先は data/village/crowd.ts）。
//
// - 人は 扉・家・村の 出口から 出てきて、行き先で 中へ 入る（消える）。立ちどまる 所では しばらく 立って、また 歩きだす
//   （バス停・タクシー乗り場は 乗って いく）。へったら 間を おいて 次の 人が 出てくる。村に 入った ときは 道の 途中にも 置く。
// - 通行人は すりぬけられる（through）：キリコも 場面の 人も ふさがない。通行人の ほうは 人の いる マスへ 入らず 待つ。
//   待ちが 長いと よけて 道を 引きなおし、それでも だめなら すりぬける。キリコが 重なったら 横へ 1歩 よける。
// - 窓（会話・選択肢）が 開いている あいだは 歩きださない。キリコが 話しかけに 向かっている 人は 待つ。
// - 時間帯（深夜・朝・昼・夕方・夜）は 1分ごとに 見なおす（人の 数と 流れが かわる）。

import {
	type CrowdNode,
	crowdLine,
	crowdSize,
	PERSONAS,
	type PedCost,
	type Persona,
	pedRoute,
	pickNext,
	pickTrip,
	type TimeBand,
	timeBand,
} from "../data/village/crowd";
import type { Script } from "../engine/defs";
import { Actor, type Field } from "../engine/field";
import { DIR_VEC, type Dir } from "../engine/types";

/** 通行人の id の 頭（村の ほかの 人と かぶらない）。 */
const PREFIX = "crowd_";
/** 前が ふさがって これだけ 待ったら よけて 道を 引きなおす（ms）。 */
const REROUTE_MS = 900;
/** これだけ 待っても 動けなければ すりぬける（細道で 向かいあった とき）。 */
const PASS_MS = 2600;
/** 次の 人が 出てくるまでの 間（ms）。 */
const SPAWN_MS: readonly [number, number] = [500, 1600];
/** 時間帯を 見なおす 間（ms）。 */
const BAND_MS = 60_000;
/** 扉・家の 前に 着いてから 消えるまで（ms）。 */
const ENTER_MS = 220;
/** 村に 入った ときに 立ちどまる 所に 置いておく 割合。 */
const START_STAYING = 0.3;

type Ped = {
	actor: Actor;
	persona: Persona;
	route: Dir[];
	to: CrowdNode;
	/** 1マス 歩く ms。 */
	ms: number;
	/** 前が ふさがって 待っている ms。 */
	blocked: number;
	rerouted: boolean;
	/** 立ちどまって いる 残り ms（0 なら 歩いている）。 */
	stay: number;
	/** 着いて 消えるまでの 残り ms（-1 なら まだ 歩いている）。 */
	vanish: number;
};

export type CrowdHost = {
	field: Field;
	nodes: readonly CrowdNode[];
	cost: PedCost;
	stage: number;
	player: Actor;
	/** 端末の 時刻（時）と 週末か（village.ts が 読む。試すときは URL の &hour・&wday）。 */
	clock: () => { hour: number; weekend: boolean };
	/** 歩きださない（窓が 開いている・村を 出る）。 */
	paused: () => boolean;
	/** キリコが 話しかけに 向かっている 相手（その 人は 待つ）。 */
	target: () => Actor | null;
	/** 話しかけた ときの スクリプト（1窓）。 */
	talk: (persona: Persona, line: string) => Script;
};

const between = (rng: () => number, [a, b]: readonly [number, number]) =>
	a + rng() * (b - a);

export class Crowd {
	private peds: Ped[] = [];
	private seq = 0;
	private spawnIn = 0;
	private bandIn = BAND_MS;
	private band: TimeBand;
	private weekend: boolean;

	constructor(
		private readonly h: CrowdHost,
		private readonly rng: () => number = Math.random,
	) {
		const c = h.clock();
		this.band = timeBand(c.hour);
		this.weekend = c.weekend;
		this.populate();
	}

	/** 通行人の 歩行グラ（入る 前に 先読みする）。 */
	static sprites(): string[] {
		return [...new Set(PERSONAS.flatMap((p) => p.sprites))];
	}

	/** その 人は 通行人か（村の 人を 並べなおす とき 残す）。 */
	owns(a: Actor): boolean {
		return this.peds.some((p) => p.actor === a);
	}

	get count(): number {
		return this.peds.length;
	}

	private get size(): number {
		return crowdSize(this.h.stage, this.band, this.weekend);
	}

	/** 村に 入った とき：道の 途中や 立ちどまる 所に 人を 置いておく。 */
	private populate(): void {
		const n = this.size;
		const stays = this.h.nodes.filter((x) => !x.enter);
		for (let i = 0, tries = 0; i < n && tries < n * 4; tries++) {
			const trip = pickTrip(this.rng, this.h.nodes, this.band, this.weekend);
			if (!trip) return;
			const route = this.route(trip.from.at, trip.to.at);
			if (!route?.length) continue;
			// 立ちどまる 所に 立っている 人
			if (stays.length && this.rng() < START_STAYING) {
				const at = stays[Math.floor(this.rng() * stays.length)];
				if (this.busy(at.at[0], at.at[1])) continue;
				const p = this.add(trip.persona, at.at, at, []);
				p.actor.dir = at.face ?? "down";
				p.stay = between(this.rng, at.stay ?? [4000, 9000]);
				i++;
				continue;
			}
			// 道の 途中を 歩いている 人
			const k = Math.floor(this.rng() * route.length);
			let [x, y] = trip.from.at;
			for (const d of route.slice(0, k)) {
				x += DIR_VEC[d].dx;
				y += DIR_VEC[d].dy;
			}
			if (k === 0 || this.busy(x, y)) continue;
			const p = this.add(trip.persona, [x, y], trip.to, route.slice(k));
			p.actor.dir = route[k - 1];
			i++;
		}
	}

	private add(
		persona: Persona,
		[x, y]: readonly [number, number],
		to: CrowdNode,
		route: Dir[],
	): Ped {
		const sprite =
			persona.sprites[Math.floor(this.rng() * persona.sprites.length)];
		const line = crowdLine(this.rng, persona, this.band);
		const id = `${PREFIX}${this.seq++}`;
		const actor = new Actor(id, x, y, route[0] ?? "down", sprite, {
			id,
			x,
			y,
			sprite,
			trigger: "talk",
			through: true,
			run: this.h.talk(persona, line),
		});
		const p: Ped = {
			actor,
			persona,
			route,
			to,
			ms: between(this.rng, persona.ms),
			blocked: 0,
			rerouted: false,
			stay: 0,
			vanish: -1,
		};
		this.peds.push(p);
		this.h.field.actors.push(actor);
		return p;
	}

	private remove(p: Ped): void {
		this.peds = this.peds.filter((q) => q !== p);
		this.h.field.actors = this.h.field.actors.filter((a) => a !== p.actor);
	}

	/** 道（通行人の 歩きにくさで。avoid の マスは 通らない）。 */
	private route(
		from: readonly [number, number],
		to: readonly [number, number],
		avoid?: (x: number, y: number) => boolean,
	): Dir[] | null {
		const f = this.h.field;
		const cost: PedCost = avoid
			? (x, y) => (avoid(x, y) ? Number.POSITIVE_INFINITY : this.h.cost(x, y))
			: this.h.cost;
		return pedRoute(f.w, f.h, cost, from, to);
	}

	/** そのマスに キリコか 見える 人（通行人も）が いるか（self は のぞく）。 */
	private busy(x: number, y: number, self?: Actor): boolean {
		const me = this.h.player;
		if (me.x === x && me.y === y) return true;
		return this.h.field.actors.some(
			(a) =>
				a !== self &&
				a.visible &&
				!!a.sprite &&
				((a.x === x && a.y === y) ||
					(a.moving && Math.round(a.fx) === x && Math.round(a.fy) === y)),
		);
	}

	update(dt: number): void {
		this.bandIn -= dt;
		if (this.bandIn <= 0) {
			this.bandIn = BAND_MS;
			const c = this.h.clock();
			this.band = timeBand(c.hour);
			this.weekend = c.weekend;
		}
		if (this.h.paused()) return;
		const target = this.h.target();
		for (const p of [...this.peds]) {
			const a = p.actor;
			if (a.moving) continue;
			if (p.vanish >= 0) {
				p.vanish -= dt;
				if (p.vanish < 0) this.remove(p);
				continue;
			}
			// 話しかけに 来る キリコを 待つ
			if (a === target) continue;
			// キリコが 重なったら 横へ よける
			const me = this.h.player;
			if (!me.moving && me.x === a.x && me.y === a.y && this.sidestep(p))
				continue;
			if (p.stay > 0) {
				p.stay -= dt;
				if (p.stay <= 0) this.leaveSpot(p);
				continue;
			}
			if (!p.route.length) {
				this.arrive(p);
				continue;
			}
			this.step(p, dt);
		}
		this.spawnIn -= dt;
		if (this.spawnIn <= 0 && this.peds.length < this.size) {
			this.spawnIn = between(this.rng, SPAWN_MS);
			this.spawn();
		}
	}

	/** 扉・家・出口から 次の 人が 出てくる。 */
	private spawn(): void {
		const trip = pickTrip(this.rng, this.h.nodes, this.band, this.weekend);
		if (!trip) return;
		const [x, y] = trip.from.at;
		if (this.busy(x, y)) return;
		const route = this.route(trip.from.at, trip.to.at);
		if (!route?.length) return;
		this.add(trip.persona, trip.from.at, trip.to, route);
	}

	private step(p: Ped, dt: number): void {
		const a = p.actor;
		const d = p.route[0];
		const nx = a.x + DIR_VEC[d].dx;
		const ny = a.y + DIR_VEC[d].dy;
		const last = p.route.length === 1;
		// 行き先が 扉なら、扉の 上に だれか いても 入っていく（重なるのは 一瞬）
		if (this.busy(nx, ny, a) && !(last && p.to.enter)) {
			p.blocked += dt;
			if (p.blocked >= REROUTE_MS && !p.rerouted) {
				p.rerouted = true;
				const r = this.route([a.x, a.y], p.to.at, (x, y) => this.busy(x, y, a));
				if (r?.length) p.route = r;
				else a.dir = d;
				return;
			}
			if (p.blocked < PASS_MS) {
				a.dir = d;
				return;
			}
		}
		p.route.shift();
		p.blocked = 0;
		p.rerouted = false;
		void a.walk(d, p.ms);
	}

	/** 行き先に 着いた：扉・家・出口なら 入って 消える、立ちどまる 所なら 立つ。 */
	private arrive(p: Ped): void {
		const to = p.to;
		if (to.face) p.actor.dir = to.face;
		if (to.enter) p.vanish = ENTER_MS;
		else p.stay = between(this.rng, to.stay ?? [4000, 9000]);
	}

	/** 立ちどまる 所を はなれる（乗り物に 乗るか、次の 行き先へ）。 */
	private leaveSpot(p: Ped): void {
		p.stay = 0;
		if (p.to.board) {
			p.vanish = 0;
			return;
		}
		const next = pickNext(this.rng, this.h.nodes, p.persona, this.band, p.to);
		const route = next && this.route([p.actor.x, p.actor.y], next.at);
		if (!next || !route?.length) {
			p.vanish = 0;
			return;
		}
		p.to = next;
		p.route = route;
	}

	/** キリコと 重なった：あいている となりの マスへ 1歩（道は その 先から 引きなおす）。 */
	private sidestep(p: Ped): boolean {
		const a = p.actor;
		const dirs: Dir[] = ["left", "right", "up", "down"];
		for (const d of dirs) {
			const nx = a.x + DIR_VEC[d].dx;
			const ny = a.y + DIR_VEC[d].dy;
			if (
				!Number.isFinite(this.h.cost(nx, ny)) ||
				this.busy(nx, ny, a) ||
				!this.h.field.tileAt(nx, ny).passable
			)
				continue;
			void a.walk(d, p.ms);
			if (p.stay > 0) {
				// 立ちどまって いた 人は もどらずに 次へ
				p.stay = 0;
				this.leaveSpot(p);
			} else {
				p.route = this.route([nx, ny], p.to.at) ?? [];
			}
			return true;
		}
		return false;
	}
}

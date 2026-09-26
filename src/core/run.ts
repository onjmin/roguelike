// 1回の冒険（ラン）。状態を持ち、プレイヤーのコマンドを受けて1ターン進める。
//
// - act(cmd) がプレイヤーの行動 → 満腹度・自然回復 → モンスターの番 → 湧き・地震 の順に進め、
//   UI に見せる出来事（GameEvent）の列を返す。
// - 倍速・鈍足は「行動できる時刻」（半ターン単位）で並べる。ふつうは 2 ずつ進む。
// - 乱数はすべて this.rng（状態は中断セーブに入る）。

import {
	attackPower,
	EXP_AT,
	HIT_RATE,
	HP_GAIN,
	HUNGER_MAX,
	HUNGER_UNIT,
	INVENTORY_MAX,
	MAX_HP_CAP,
	MAX_LV,
	MONSTER_CAP,
	QUAKE_TURNS,
	REGEN_STEP,
	rollDamage,
	SPAWN_EVERY,
	START_HP,
	START_STR,
	WAKE_CHANCE,
} from "./balance";
import { type Dungeon, dungeonById } from "./data/dungeons";
import { ITEM_LIST } from "./data/items";
import { FAKE_NAMES } from "./data/names";
import { dealDeck } from "./deck";
import { throwItem, useItem } from "./effects";
import { buildFloor, randomFloorPos, spawnMonster } from "./floor";
import { canSee, forEachExitPeek, forEachVisible } from "./fov";
import {
	DIRS8,
	type Dir8,
	DX,
	DY,
	dist,
	isDiagonal,
	type Pos,
	samePos,
	step,
} from "./geom";
import {
	defOf,
	identifyKind,
	isKeyItem,
	isKnownKind,
	itemName,
	kindName,
	rollItem,
} from "./item";
import { isFloor, roomAt, T_WALL, tileAt } from "./mapgen";
import {
	mdef,
	monsterAct,
	monsterName,
	noticeAdjacent,
	wakeMonster,
} from "./monster";
import { recordCmd } from "./replay";
import { Rng } from "./rng";
import { triggerTrap } from "./traps";
import {
	CAT_ORDER,
	type Command,
	DOZE,
	type DungeonId,
	type Floor,
	type FloorItem,
	type GameEvent,
	HOLD,
	type Item,
	type ItemCat,
	type Monster,
	PLAYER_ID,
	type Player,
	type RunState,
	UNIDENTIFIED_CATS,
} from "./types";

export const SAVE_VERSION = 2;

/**
 * 古い版の中断セーブを 今の形にそろえる（読めなければ null）。
 * v1：ダンジョンが1つだったころ → 本編（main）。
 */
export const migrateRun = (s: RunState): RunState | null => {
	if (s.v === 1) {
		s.dungeon = "main";
		s.v = 2;
	}
	if (s.v !== SAVE_VERSION) return null;
	if (!s.dungeon || dungeonById(s.dungeon).id !== s.dungeon) return null;
	return s;
};

export class Run {
	s: RunState;
	rng: Rng;
	ev: GameEvent[] = [];

	constructor(s: RunState) {
		this.s = s;
		this.rng = new Rng(s.rng);
	}

	/**
	 * 新しく潜る。本編（main）は ダンジョンを増やす前と 同じ順に乱数を引く
	 * （中断セーブ・リプレイ・parity の基準が そのまま通るように）。
	 */
	static create(
		seed: string,
		dungeon: DungeonId = "main",
		carry: readonly Item[] = [],
	): Run {
		const dg = dungeonById(dungeon);
		const rng = Rng.fromSeed(seed);
		const deal = dealDeck(rng, dg.deck, dg.floors);
		// モンスターハウス（祭り）の階（本編は 3階から 1/16 ずつ。B6 までに無ければ B4〜6 のどこかに1つ）。
		// ハウスの階には札を多めに寄せる
		const houses: number[] = [];
		if (dg.houses) {
			const h = dg.houses;
			for (let d = h.from; d <= dg.floors; d++)
				if (rng.chance(h.chance)) houses.push(d);
			const early = h.early;
			if (early && !houses.some((d) => d <= early[1])) {
				houses.push(rng.range(early[0], early[1]));
				houses.sort((a, b) => a - b);
			}
		}
		rebalanceForHouses(rng, deal, houses);
		// 未識別の名前の割り当て（このダンジョンの山札にある種類）
		const fake: Record<string, string> = {};
		for (const cat of UNIDENTIFIED_CATS) {
			const names = rng.shuffle([...(FAKE_NAMES[cat] ?? [])]);
			const kinds = [...new Set(dg.deck.map((e) => e.kind))].filter(
				(k) => defOf(k).cat === cat,
			);
			kinds.forEach((k, i) => {
				fake[k] = names[i % names.length];
			});
		}
		// このダンジョンで未識別でない分類は、はじめから ぜんぶ わかっている
		const known: Record<string, true> = {};
		for (const d of ITEM_LIST)
			if (UNIDENTIFIED_CATS.includes(d.cat) && !dg.unidentified.includes(d.cat))
				known[d.id] = true;
		const player: Player = {
			x: 0,
			y: 0,
			dir: 4,
			hp: START_HP,
			maxHp: START_HP,
			str: START_STR,
			maxStr: START_STR,
			lv: 1,
			exp: 0,
			hunger: HUNGER_MAX,
			regenAcc: 0,
			weapon: null,
			shield: null,
			ring: null,
			items: [],
			status: {
				sleep: 0,
				confuse: 0,
				blind: 0,
				fast: 0,
				trapped: 0,
				heldBy: null,
			},
			nextAt: 0,
		};
		const s: RunState = {
			v: SAVE_VERSION,
			seed,
			dungeon: dg.id,
			rng: rng.state(),
			depth: 0,
			turn: 0,
			time: 0,
			player,
			floor: null as unknown as Floor,
			deal,
			houses,
			cardKind: {},
			seen: [],
			lost: [],
			flowed: 0,
			ids: { fake, known, named: {} },
			nextUid: 1,
			log: [],
			replay: "",
			replayN: 0,
			kills: {},
			returning: false,
			end: null,
			stats: { maxDepth: 0, itemsUsed: 0 },
		};
		const run = new Run(s);
		run.rng = rng;
		// 始めの持ち物（山札の外。毎回同じ）：本編は大きなパン
		for (const k of dg.start) player.items.push(run.newItem(k));
		// 倉庫から持ちこんだ道具（乱数は引かない。番号だけ この冒険のものに。種類は わかっている）
		if (carry.length) {
			s.carriedIn = carry.map((it) => ({ ...it }));
			for (const it of carry) {
				player.items.push({ ...it, uid: s.nextUid++ });
				s.ids.known[it.kind] = true;
			}
		}
		run.enterFloor(1, false);
		run.s.rng = run.rng.state();
		return run;
	}

	// ───────────────── 出来事 ─────────────────

	msg(text: string, tone?: "warn" | "good"): void {
		this.ev.push({ t: "msg", text, tone });
		this.s.log.push(text);
		if (this.s.log.length > 300) this.s.log.splice(0, this.s.log.length - 300);
	}

	se(name: string): void {
		this.ev.push({ t: "se", name });
	}

	emit(e: GameEvent): void {
		this.ev.push(e);
	}

	get p(): Player {
		return this.s.player;
	}

	get f(): Floor {
		return this.s.floor;
	}

	// ───────────────── 道具 ─────────────────

	newItem(kind: string): Item {
		return rollItem(this.rng, this.s.nextUid++, kind, {
			curses: this.dungeon.curses,
		});
	}

	/** このダンジョン。 */
	get dungeon(): Dungeon {
		return dungeonById(this.s.dungeon);
	}

	/** その階が 本編の何階ぶんの強さか（敵・罠・祭りの大きさ・変化の杖を引くのに使う）。 */
	levelAt(depth: number): number {
		const l = this.dungeon.level;
		return l[Math.max(1, Math.min(l.length - 1, depth))];
	}

	/** いちばん底で、まだ下りられない（目的の品を拾う前）。 */
	get atBottom(): boolean {
		return !this.s.returning && this.s.depth >= this.dungeon.floors;
	}

	name(it: Item): string {
		return itemName(this.s, it);
	}

	kindName(kind: string): string {
		return kindName(this.s, kind);
	}

	findItem(uid: number): Item | undefined {
		return this.p.items.find((i) => i.uid === uid);
	}

	isEquipped(it: Item): boolean {
		const p = this.p;
		return (
			p.weapon === it.uid ||
			p.shield === it.uid ||
			p.ring === it.uid ||
			p.arrow === it.uid
		);
	}

	/** 装備している矢（撃つ ボタンで 撃つ束）。 */
	arrows(): Item | null {
		return this.findItem(this.p.arrow ?? -1) ?? null;
	}

	weapon(): Item | null {
		return this.findItem(this.p.weapon ?? -1) ?? null;
	}

	shield(): Item | null {
		return this.findItem(this.p.shield ?? -1) ?? null;
	}

	ring(): Item | null {
		return this.findItem(this.p.ring ?? -1) ?? null;
	}

	hasRing(kind: string): boolean {
		return this.ring()?.kind === kind;
	}

	/** 持ち物から外す（装備も外す）。 */
	removeItem(it: Item): void {
		const p = this.p;
		// 指輪の後始末は、持ち物から消す前に（剛力の指輪のちからを戻すのに指輪を引くので）
		if (p.ring === it.uid) this.unsetRing();
		p.items = p.items.filter((i) => i !== it);
		if (p.weapon === it.uid) p.weapon = null;
		if (p.shield === it.uid) p.shield = null;
		if (p.arrow === it.uid) p.arrow = null;
	}

	/** 指輪を外したときの後始末（剛力の指輪）。 */
	private unsetRing(): void {
		const r = this.ring();
		this.p.ring = null;
		if (r?.kind === "r_might") this.applyMight(-r.plus);
	}

	/** 剛力の指輪の ±。 */
	applyMight(delta: number): void {
		const p = this.p;
		p.maxStr = Math.max(1, p.maxStr + delta);
		p.str = Math.max(1, Math.min(p.maxStr, p.str + delta));
	}

	/** 持ち物に入れる。いっぱいなら false。矢は同じ種類にまとめる。 */
	addItem(it: Item): boolean {
		const p = this.p;
		if (defOf(it.kind).cat === "arrow") {
			const same = p.items.find((i) => i.kind === it.kind);
			if (same) {
				same.count += it.count;
				return true;
			}
		}
		if (p.items.length >= INVENTORY_MAX) return false;
		p.items.push(it);
		return true;
	}

	itemAt(x: number, y: number): FloorItem | undefined {
		return this.f.items.find((i) => i.x === x && i.y === y);
	}

	/**
	 * 床に置く（そのマスが埋まっていれば、まわり8マスのどこか）。置けなければ消える（false）。
	 */
	placeItem(it: Item, at: Pos, quiet = false): boolean {
		const cands: Pos[] = [at];
		const around = this.rng.shuffle(DIRS8.map((d) => step(at, d)));
		cands.push(...around);
		for (const c of cands) {
			if (!isFloor(this.f.layout, c.x, c.y)) continue;
			if (this.itemAt(c.x, c.y)) continue;
			if (samePos(c, this.f.stairs)) continue;
			if (this.f.wards.includes(c.y * this.f.layout.w + c.x)) continue;
			this.f.items.push({ x: c.x, y: c.y, item: it });
			return true;
		}
		if (!quiet) this.msg(`${this.name(it)}は　消えてしまった`);
		this.loseItem(it);
		return false;
	}

	/** 道具が燃えた・消えた（山札の表で「なくなった」と数える）。 */
	loseItem(it: Item): void {
		if (this.s.cardKind[it.uid] && !this.s.lost.includes(it.uid))
			this.s.lost.push(it.uid);
	}

	/** 床の道具を消す（地雷・爆発・火）。 */
	destroyFloorItem(fi: FloorItem): void {
		// 原盤は燃えない・爆発で消えない（持ち帰れなくなるので）
		if (isKeyItem(fi.item.kind)) return;
		this.f.items = this.f.items.filter((i) => i !== fi);
		this.loseItem(fi.item);
	}

	// ───────────────── 地形・位置 ─────────────────

	monsterAt(x: number, y: number): Monster | undefined {
		return this.f.monsters.find((m) => m.x === x && m.y === y && m.hp > 0);
	}

	isPlayerAt(x: number, y: number): boolean {
		return this.p.x === x && this.p.y === y;
	}

	/** 斜めの角ぬけ（壁の角をかすめる移動・攻撃）ができるか。 */
	cornerOk(from: Pos, d: Dir8): boolean {
		if (!isDiagonal(d)) return true;
		const l = this.f.layout;
		return (
			tileAt(l, from.x + DX[d], from.y) !== T_WALL &&
			tileAt(l, from.x, from.y + DY[d]) !== T_WALL
		);
	}

	/** from から d へ1歩動けるか（地形だけ。キャラは見ない）。 */
	canStepTerrain(from: Pos, d: Dir8): boolean {
		const to = step(from, d);
		return isFloor(this.f.layout, to.x, to.y) && this.cornerOk(from, d);
	}

	/** 空いている床か（キャラがいない）。 */
	isFree(x: number, y: number): boolean {
		return (
			isFloor(this.f.layout, x, y) &&
			!this.monsterAt(x, y) &&
			!this.isPlayerAt(x, y)
		);
	}

	/** プレイヤーから見えるか（目が見えないときは となりだけ）。 */
	playerSees(pos: Pos): boolean {
		if (this.p.status.blind > 0) return dist(this.p, pos) <= 1;
		return canSee(this.f.layout, this.p, pos);
	}

	/** そのモンスターがプレイヤーに見えているか（見えない敵・化けた敵は別）。 */
	monsterVisible(m: Monster): boolean {
		if (m.hp <= 0) return false;
		const d = mdef(m);
		if (d.abilities.some((a) => a.k === "invisible") && !m.status.sealed) {
			if (!this.f.sight) return false;
		}
		if (this.f.senseMonsters && this.p.status.blind <= 0) return true;
		return this.playerSees(m);
	}

	/** その階の階段の上にいるか。 */
	onStairs(): boolean {
		return samePos(this.p, this.f.stairs);
	}

	/** この階の、まだ見ていない札の数（床・モンスターの持ち物）。 */
	cardsLeft(): number {
		const seen = new Set(this.s.seen);
		const lost = new Set(this.s.lost);
		return this.f.cards.filter((u) => !seen.has(u) && !lost.has(u)).length;
	}

	// ───────────────── 見える範囲 ─────────────────

	/** 見えているマスを踏破ずみにし、見えている道具を「見た」にする。 */
	updateVision(): void {
		const f = this.f;
		const l = f.layout;
		if (this.p.status.blind > 0) return;
		forEachVisible(l, this.p, (x, y) => {
			f.seen[y * l.w + x] = 1;
		});
		forEachExitPeek(l, this.p, (x, y) => {
			f.seen[y * l.w + x] = 1;
		});
		const seen = new Set(this.s.seen);
		for (const fi of f.items) {
			if (seen.has(fi.item.uid)) continue;
			if (this.playerSees(fi)) this.s.seen.push(fi.item.uid);
		}
		// モンスターハウス
		if (
			f.house >= 0 &&
			!f.houseAwake &&
			roomAt(l, this.p.x, this.p.y) === f.house
		) {
			f.houseAwake = true;
			if (!this.hasRing("r_stealth")) {
				for (const m of f.monsters)
					if (roomAt(l, m.x, m.y) === f.house && m.status.sleep === DOZE) {
						m.status.sleep = 0;
						this.graceAfterWake(m);
					}
			}
			this.emit({ t: "house" });
			this.se("encounter");
			this.msg("祭りだ！　野次馬が　あふれている！", "warn");
		}
	}

	/** 眠っている敵を起こす判定（入室・となり）。 */
	private checkWake(
		before: Map<number, { near: boolean; adj: boolean }>,
	): void {
		for (const m of this.f.monsters) {
			// 近づいて起きるのは ふつうの眠り（DOZE）だけ。杖や草で眠らせた5ターンは起きない
			if (m.hp <= 0 || m.status.sleep !== DOZE) continue;
			const near = canSee(this.f.layout, m, this.p);
			const adj = dist(m, this.p) <= 1;
			const was = before.get(m.uid);
			const entered = near && !was?.near;
			const touched = adj && !was?.adj;
			if (!entered && !touched) continue;
			if (this.hasRing("r_stealth")) continue;
			if (this.hasRing("r_clamor") || this.rng.chance(WAKE_CHANCE)) {
				wakeMonster(this, m);
				this.graceAfterWake(m);
			}
		}
	}

	/**
	 * 近づかれて目を覚ました敵は、このターンは まだ動かない（寝起き。トルネコ1と同じく、
	 * 起こしたとたんに なぐられはしない）。次のキリコの番のあとから動く。
	 */
	private graceAfterWake(m: Monster): void {
		m.nextAt = Math.max(m.nextAt, this.p.nextAt + 2);
	}

	private nearMap(): Map<number, { near: boolean; adj: boolean }> {
		const out = new Map<number, { near: boolean; adj: boolean }>();
		for (const m of this.f.monsters)
			out.set(m.uid, {
				near: canSee(this.f.layout, m, this.p),
				adj: dist(m, this.p) <= 1,
			});
		return out;
	}

	// ───────────────── 階の移動 ─────────────────

	/** 階に入る（下りなら depth+1、帰り道なら depth−1）。 */
	enterFloor(depth: number, fell: boolean): void {
		const s = this.s;
		if (s.floor) {
			// 見ないまま流れる札
			s.flowed += this.cardsLeft();
		}
		s.depth = depth;
		s.stats.maxDepth = Math.max(s.stats.maxDepth, depth);
		const kinds = s.returning ? [] : (s.deal[depth] ?? []);
		s.deal[depth] = [];
		s.floor = buildFloor(
			this,
			depth,
			kinds,
			s.houses.includes(depth) && !s.returning,
		);
		const p = this.p;
		// 目つぶし・混乱・眠り・倍速は 階を かわっても とけない（トルネコ1と おなじ）
		p.status.trapped = 0;
		p.status.heldBy = null;
		p.nextAt = s.time;
		for (const m of s.floor.monsters) m.nextAt = s.time;
		this.emit({ t: "floor", depth, up: s.returning });
		if (fell) this.msg("下の階に　落ちた");
		this.updateVision();
	}

	/** 階段を使う。 */
	private useStairs(): boolean {
		if (!this.onStairs()) {
			this.msg("ここに　階段は　ない");
			return false;
		}
		if (this.atBottom) {
			this.msg("これより　下へは　行けないようだ");
			return false;
		}
		this.se("stairs");
		if (this.s.returning) {
			const next = this.s.depth - 1;
			if (next <= 0) {
				this.finish("clear", `${defOf(this.dungeon.goal).name}を　持ち帰った`);
				return false;
			}
			this.enterFloor(next, false);
		} else {
			this.enterFloor(this.s.depth + 1, false);
		}
		return false;
	}

	/** 落とし穴・地震で下の階へ。 */
	fallDown(): void {
		if (this.s.depth >= this.dungeon.floors) {
			this.msg("しかし　これより　下は　なかった");
			return;
		}
		this.enterFloor(this.s.depth + 1, true);
	}

	// ───────────────── 終わり ─────────────────

	finish(kind: "dead" | "clear" | "escape", cause: string): void {
		if (this.s.end) return;
		this.s.end = { kind, cause, depth: this.s.depth, turn: this.s.turn };
		if (kind === "dead") this.se("wipeout");
		this.emit({ t: "end" });
	}

	/** プレイヤーが傷つく。倒れたら true。 */
	hurtPlayer(amount: number, cause: string): boolean {
		const p = this.p;
		p.hp = Math.max(0, p.hp - amount);
		this.emit({
			t: "hurt",
			id: PLAYER_ID,
			pos: { x: p.x, y: p.y },
			amount,
			hp: p.hp,
		});
		if (p.hp <= 0) {
			this.msg("キリコは　たおれた……", "warn");
			this.finish("dead", cause);
			return true;
		}
		return false;
	}

	healPlayer(amount: number): number {
		const p = this.p;
		const before = p.hp;
		p.hp = Math.min(p.maxHp, p.hp + amount);
		const got = p.hp - before;
		if (got > 0)
			this.emit({
				t: "heal",
				id: PLAYER_ID,
				pos: { x: p.x, y: p.y },
				amount: got,
			});
		return got;
	}

	// ───────────────── 成長 ─────────────────

	gainExp(n: number): void {
		const p = this.p;
		p.exp = Math.min(999999, p.exp + n);
		let up = 0;
		while (p.lv < MAX_LV && p.exp >= EXP_AT[p.lv]) {
			p.lv++;
			up++;
			const g = this.rng.pick(HP_GAIN);
			p.maxHp = Math.min(MAX_HP_CAP, p.maxHp + g);
			p.hp = Math.min(p.maxHp, p.hp + g);
		}
		if (up > 0) {
			// 何段上がっても音は1回（続けて鳴るとうるさい）
			this.se("levelup");
			this.emit({ t: "levelup", lv: p.lv });
			this.msg(`レベルが　${p.lv}に　上がった！`, "good");
		}
	}

	/** レベルを1つ下げる。 */
	drainLevel(): void {
		const p = this.p;
		if (p.lv <= 1) return;
		p.lv--;
		p.exp = Math.max(0, EXP_AT[p.lv] - 1);
		const g = this.rng.pick(HP_GAIN);
		p.maxHp = Math.max(1, p.maxHp - g);
		p.hp = Math.min(p.hp, p.maxHp);
		this.msg(`レベルが　${p.lv}に　下がった`, "warn");
	}

	// ───────────────── 戦闘 ─────────────────

	/** プレイヤーの素の攻撃に使う「武器の強さ＋ちから」。 */
	meleePower(): number {
		const w = this.weapon();
		const wAtk = w ? (defOf(w.kind).atk ?? 0) + w.plus : 0;
		return Math.max(0, wAtk) + this.p.str;
	}

	/** プレイヤーの防御（盾の強さ）。 */
	playerDef(): number {
		const sh = this.shield();
		return sh ? Math.max(0, (defOf(sh.kind).def ?? 0) + sh.plus) : 0;
	}

	/** ダメージの乱数（112〜143）。 */
	dmgRoll(): number {
		return 112 + this.rng.int(32);
	}

	/** 武器の音（振った・当たった）。素手なら 素手の音。 */
	private weaponSound(): { swing: string; hit: string } {
		const w = this.weapon();
		return (
			(w && defOf(w.kind).sound) ?? { swing: "swing_fist", hit: "hit_fist" }
		);
	}

	/** プレイヤーがモンスターをなぐる。 */
	playerAttack(m: Monster): void {
		const d = mdef(m);
		this.emit({ t: "attack", id: PLAYER_ID, dir: this.p.dir });
		if (m.disguise) {
			m.disguise = null;
			this.msg(`${monsterName(this, m)}が　化けていた！`, "warn");
		}
		wakeMonster(this, m, true);
		if (!this.rng.chance(HIT_RATE)) {
			// はずれは 振った音だけ（トルネコ1と同じ）
			this.se(this.weaponSound().swing);
			this.emit({ t: "miss", id: m.uid, pos: { x: m.x, y: m.y } });
			this.msg("キリコの　攻撃は　はずれた");
			return;
		}
		const atk = attackPower(this.p.lv, this.meleePower());
		let dmg = rollDamage(atk, d.def, this.dmgRoll());
		if (d.tags?.includes("dragon") && this.weapon()?.kind === "wyrmbane")
			dmg *= 2;
		this.se(this.weaponSound().hit);
		this.damageMonster(m, dmg, "hit");
	}

	/**
	 * モンスターにダメージ。倒したら true。
	 * by: "hit"（なぐった）・"throw"・"magic"・"blast"（経験値あり）・"none"（経験値なし）
	 */
	damageMonster(
		m: Monster,
		amount: number,
		by: "hit" | "throw" | "magic" | "blast" | "none" | "holy",
	): boolean {
		const d = mdef(m);
		const sealed = m.status.sealed;
		if (d.abilities.some((a) => a.k === "metal")) amount = Math.min(amount, 1);
		// かたい鎧：なぐる攻撃は半分（杖・投げた物・爆発は そのまま）
		if (by === "hit" && !sealed && d.abilities.some((a) => a.k === "armor")) {
			amount = Math.max(1, Math.ceil(amount / 2));
			this.msg("かたい　鎧に　はばまれた");
		}
		amount = Math.max(0, amount);
		m.hp -= amount;
		this.emit({ t: "hurt", id: m.uid, pos: { x: m.x, y: m.y }, amount });
		const nm = monsterName(this, m);
		this.msg(`${nm}に　${amount}の　ダメージ`);
		if (m.hp <= 0) {
			// 一度だけ起き上がる（投げた薬草で たおすか、封印していれば起きない）
			if (
				!m.revived &&
				by !== "holy" &&
				by !== "none" &&
				!sealed &&
				d.abilities.some((a) => a.k === "revive")
			) {
				m.revived = true;
				m.hp = Math.max(1, Math.ceil(m.maxHp / 4));
				this.emit({
					t: "heal",
					id: m.uid,
					pos: { x: m.x, y: m.y },
					amount: m.hp,
				});
				this.msg(`${nm}は　起き上がった！　……ほ……しゅ……`, "warn");
				return false;
			}
			this.killMonster(m, by !== "none");
			return true;
		}
		// 怒る（赤鬼）
		if (
			!sealed &&
			!m.enraged &&
			m.hp <= m.maxHp / 2 &&
			d.abilities.some((a) => a.k === "berserk")
		) {
			m.enraged = true;
			m.status.fast = 999;
			m.status.slow = 0;
			this.msg(`${nm}は　怒りだした！`, "warn");
		}
		// なぐられたときの反応
		if (by === "hit" || by === "throw" || by === "magic") {
			for (const a of d.abilities) {
				if (m.status.sealed) break;
				if (a.k === "split" && this.rng.chance(a.rate)) this.splitMonster(m);
				if (a.k === "metal") {
					const to = randomFloorPos(this, true);
					if (to) {
						this.emit({ t: "warp", id: m.uid, from: { x: m.x, y: m.y }, to });
						m.x = to.x;
						m.y = to.y;
						this.msg(`${nm}は　どこかへ　逃げた`);
					}
				}
			}
			if (d.abilities.some((a) => a.k === "explode") && !m.status.sealed) {
				if (m.hp <= 9) {
					this.explode(m);
				} else if (m.hp <= 29 && !m.fuse) {
					m.fuse = true;
					this.msg(`${nm}の　動きが　止まった……`, "warn");
				}
			}
		}
		return false;
	}

	/** burnt：爆発で たおれた（落とす道具も 燃える）。 */
	killMonster(m: Monster, giveExp: boolean, burnt = false): void {
		const d = mdef(m);
		m.hp = 0;
		this.emit({ t: "die", id: m.uid, pos: { x: m.x, y: m.y } });
		this.se("enemyDown");
		this.msg(`${monsterName(this, m)}を　たおした`);
		this.f.monsters = this.f.monsters.filter((x) => x !== m);
		if (this.p.status.heldBy === m.uid) this.p.status.heldBy = null;
		this.s.kills[d.id] = (this.s.kills[d.id] ?? 0) + 1;
		if (m.carry) {
			const it = m.carry;
			m.carry = null;
			this.placeItem(it, m);
		}
		// 必ず落とす道具（メタルぷゆゆ → 成長の実）。何を落とすかは 知られているので 正体もわかる
		if (d.drop && !burnt) {
			const it = this.newItem(d.drop);
			identifyKind(this.s, it.kind);
			this.msg(
				`${monsterName(this, m)}は　${this.name(it)}を　落とした！`,
				"good",
			);
			this.placeItem(it, m);
		}
		if (giveExp) this.gainExp(d.exp);
	}

	/** ばくだんの爆発（5×5 のモンスターと道具が消える。巻きこまれると HP が 1 に）。 */
	explode(m: Monster): void {
		const cx = m.x;
		const cy = m.y;
		this.se("explosion");
		this.emit({ t: "fx", kind: "explosion", pos: { x: cx, y: cy } });
		this.msg(`${monsterName(this, m)}は　爆発した！`, "warn");
		m.hp = 0;
		this.f.monsters = this.f.monsters.filter((x) => x !== m);
		// 持っていた札も いっしょに燃える
		if (m.carry) {
			this.loseItem(m.carry);
			m.carry = null;
		}
		if (this.p.status.heldBy === m.uid) this.p.status.heldBy = null;
		const inArea = (p: Pos) =>
			Math.abs(p.x - cx) <= 2 && Math.abs(p.y - cy) <= 2;
		for (const o of [...this.f.monsters])
			if (inArea(o)) this.killMonster(o, false, true);
		for (const fi of [...this.f.items])
			if (inArea(fi)) this.destroyFloorItem(fi);
		if (inArea(this.p)) {
			if (this.p.hp <= 1)
				this.hurtPlayer(1, "ばくだんの　爆発に　巻きこまれた");
			else this.hurtPlayer(this.p.hp - 1, "ばくだんの　爆発に　巻きこまれた");
		}
	}

	splitMonster(m: Monster): void {
		if (this.f.monsters.length >= MONSTER_CAP) return;
		const spots = this.rng
			.shuffle([...DIRS8])
			.map((d) => step(m, d))
			.filter((p) => this.isFree(p.x, p.y));
		const at = spots[0];
		if (!at) return;
		const c = spawnMonster(this, mdef(m).id, at, { awake: true });
		if (c) {
			// 分かれる 音と 絵（ui/play.ts の appear）を 先に、それから ログ
			this.se("spell");
			this.emit({ t: "appear", id: c.uid, pos: at, from: { x: m.x, y: m.y } });
			this.msg(`${monsterName(this, m)}が　ふえた！`, "warn");
		}
	}

	/** 同じ階のどこかへワープさせる（プレイヤー）。 */
	warpPlayer(): void {
		const to = randomFloorPos(this, false);
		if (!to) return;
		const from = { x: this.p.x, y: this.p.y };
		this.p.x = to.x;
		this.p.y = to.y;
		this.p.status.heldBy = null;
		this.p.status.trapped = 0;
		this.se("warp");
		this.emit({ t: "warp", id: PLAYER_ID, from, to });
		this.updateVision();
	}

	// ───────────────── ターンの進み ─────────────────

	/** プレイヤーのコマンドを実行し、出来事を返す。 */
	act(cmd: Command): GameEvent[] {
		this.ev = [];
		if (this.s.end) return this.ev;
		const before = this.nearMap();
		const used = this.doCommand(cmd);
		if (used && !this.s.end) this.endTurn(before);
		// 眠っている・動けないあいだは自動で進む
		let guard = 0;
		while (!this.s.end && this.p.status.sleep > 0 && guard++ < 50) {
			this.endTurn(this.nearMap());
		}
		this.s.rng = this.rng.state();
		// リプレイの記録（指紋は このコマンドのあとの状態で とる）
		recordCmd(this.s, cmd);
		return this.ev;
	}

	/** 1ターンぶん時間を進める（プレイヤーの行動のあと）。 */
	private endTurn(before: Map<number, { near: boolean; adj: boolean }>): void {
		const s = this.s;
		const p = this.p;
		const f = this.f;
		s.turn++;
		f.turns++;
		this.updateVision();
		this.checkWake(before);

		// 満腹度（帰り道は減らない）
		if (!s.returning) this.tickHunger();
		if (s.end) return;

		// 自然回復（おなかが空っぽのときは回復しない）
		if (p.hunger > 0 && p.hp < p.maxHp) {
			p.regenAcc += p.maxHp;
			while (p.regenAcc >= REGEN_STEP) {
				p.regenAcc -= REGEN_STEP;
				if (p.hp < p.maxHp) p.hp++;
			}
		}

		// モンスターの番
		const cost = p.status.fast > 0 ? 1 : 2;
		p.nextAt += cost;
		let guard = 0;
		for (;;) {
			if (s.end || guard++ > 400) break;
			let next: Monster | null = null;
			for (const m of f.monsters) {
				if (m.hp <= 0 || m.nextAt >= p.nextAt) continue;
				if (
					!next ||
					m.nextAt < next.nextAt ||
					(m.nextAt === next.nextAt && m.uid < next.uid)
				)
					next = m;
			}
			if (!next) break;
			const m = next;
			m.nextAt += monsterCost(m);
			monsterAct(this, m);
			if (this.f !== f) break; // ワープの罠などで階が変わった
		}
		s.time = p.nextAt;
		if (s.end) return;
		if (this.f === f) noticeAdjacent(this);
		// 状態の時間切れ（敵の番のあと。目を覚ましたら、次はキリコが先に動ける）
		this.tickStatus();
		if (this.f !== f) return;

		// 湧き
		if (f.turns % SPAWN_EVERY === 0 && f.monsters.length < MONSTER_CAP) {
			const at = randomFloorPos(this, true);
			if (at) spawnMonster(this, null, at, {});
		}

		// 地震
		const qi = QUAKE_TURNS.indexOf(f.turns);
		if (qi >= 0) {
			this.emit({ t: "quake", level: qi + 1 });
			if (qi < QUAKE_TURNS.length - 1) {
				// 2ch の スレの おわりに なぞらえる（950 で 次スレ、1000 まで 埋め、1001 で 落ちる）
				this.msg(
					qi === 0
						? "このスレも　950を　こえた……　床が　ゆれている"
						: "埋めが　はじまった！　ゆれが　強くなってきた！",
					"warn",
				);
			} else {
				this.msg("このスレッドは　1000を　超えました。", "warn");
				this.msg("もう　書けないので、下の階へ　落ちる……", "warn");
				this.fallDown();
				return;
			}
		}
		this.updateVision();
	}

	private tickStatus(): void {
		const st = this.p.status;
		if (st.sleep > 0 && --st.sleep === 0) this.msg("キリコは　目を　さました");
		if (st.confuse > 0 && --st.confuse === 0) this.msg("混乱が　とけた");
		if (st.blind > 0 && --st.blind === 0) {
			this.msg("目が　見えるように　なった");
			this.updateVision();
		}
		if (st.fast > 0 && --st.fast === 0)
			this.msg("足の　速さが　もとに　もどった");
		if (st.trapped > 0) st.trapped--;
	}

	private tickHunger(): void {
		const p = this.p;
		if (this.hasRing("r_sustain")) return;
		let dec = 2;
		const leather = this.shield()?.kind === "leather";
		const glutton = this.hasRing("r_hunger");
		if (leather && !glutton) dec = 1;
		else if (glutton && !leather) dec = 4;
		const before = p.hunger;
		p.hunger = Math.max(0, p.hunger - dec);
		const pct = (h: number) => Math.ceil(h / HUNGER_UNIT);
		if (pct(before) > 20 && pct(p.hunger) <= 20)
			this.msg("おなかが　へってきた", "warn");
		if (pct(before) > 10 && pct(p.hunger) <= 10)
			this.msg("おなかが　ぺこぺこだ……", "warn");
		if (before > 0 && p.hunger === 0)
			this.msg("はらぺこで　目が　まわる！", "warn");
		if (p.hunger === 0) this.hurtPlayer(1, "おなかが　すいて　たおれた");
	}

	/** おなかを満たす（%）。 */
	feed(pct: number): void {
		const p = this.p;
		p.hunger = Math.min(HUNGER_MAX, p.hunger + pct * HUNGER_UNIT);
	}

	// ───────────────── プレイヤーの行動 ─────────────────

	/** コマンドを実行。時間が進んだら true。 */
	private doCommand(cmd: Command): boolean {
		const p = this.p;
		switch (cmd.c) {
			case "turn":
				p.dir = cmd.dir;
				this.emit({ t: "turn", id: PLAYER_ID, dir: cmd.dir });
				return false;
			case "move":
				return this.doMove(cmd.dir, !!cmd.noPickup);
			case "attack":
				return this.doAttack(cmd.dir ?? p.dir);
			case "wait":
				return true;
			case "pickup":
				return this.doPickup(true);
			case "use":
				return useItem(this, cmd.item, cmd.target);
			case "throw":
				return throwItem(this, cmd.item, cmd.dir ?? p.dir);
			case "drop":
				return this.doDrop(cmd.item);
			case "equip":
				return this.doEquip(cmd.item);
			case "unequip":
				return this.doUnequip(cmd.item);
			case "swap":
				return this.doSwap(cmd.item);
			case "stairs":
				return this.useStairs();
			case "name":
				if (cmd.text) this.s.ids.named[cmd.kind] = cmd.text;
				else delete this.s.ids.named[cmd.kind];
				return false;
			case "sort":
				this.sortItems();
				return false;
			case "shoot": {
				// 装備した矢を 1本、向いている方へ（トルネコ1の 矢の装備と同じ）
				const a = this.arrows();
				if (!a) {
					this.msg("矢を　装備していない");
					return false;
				}
				return throwItem(this, a.uid, p.dir);
			}
		}
	}

	/**
	 * 持ち物を 整理する（時間は進まない）。分類の順（武器・盾・指輪・草・スレ・杖・矢・食べもの）に並べ、
	 * 同じ分類では 正体のわかる物を 図鑑の順に、わからない物は そのあとに 呼び名の順で まとめる
	 * （わからない物を 本当の順に並べると 正体が もれるので）。同じ物どうしは もとの順のまま。
	 */
	sortItems(): void {
		const s = this.s;
		const known = (it: Item) => isKnownKind(s, it.kind);
		const rows = this.p.items.map((it, i) => ({
			it,
			i,
			cat: CAT_ORDER.indexOf(defOf(it.kind).cat),
			known: known(it),
			order: defOf(it.kind).order,
			name: kindName(s, it.kind),
		}));
		rows.sort(
			(a, b) =>
				a.cat - b.cat ||
				Number(b.known) - Number(a.known) ||
				(a.known
					? a.order - b.order
					: a.name < b.name
						? -1
						: a.name > b.name
							? 1
							: 0) ||
				a.i - b.i,
		);
		const before = this.p.items.map((it) => it.uid).join();
		this.p.items = rows.map((r) => r.it);
		if (this.p.items.map((it) => it.uid).join() !== before)
			this.msg("持ち物を　整理した");
	}

	/** 混乱しているときの向き。 */
	private confusedDir(d: Dir8): Dir8 {
		return this.p.status.confuse > 0 ? this.rng.pick(DIRS8) : d;
	}

	private doMove(dir: Dir8, noPickup: boolean): boolean {
		const p = this.p;
		const st = p.status;
		// 見えている敵の方へは、向くだけ（なぐるのは A。向いてから投げたり 杖を振ったりできるように）
		{
			const d0 = st.confuse > 0 ? null : dir;
			const t0 = d0 === null ? null : step(p, d0);
			const target = t0 ? this.monsterAt(t0.x, t0.y) : null;
			if (
				d0 !== null &&
				target &&
				!target.disguise &&
				this.monsterVisible(target) &&
				this.cornerOk(p, d0)
			) {
				p.dir = d0;
				this.emit({ t: "turn", id: PLAYER_ID, dir: d0 });
				return false;
			}
		}
		if (st.heldBy !== null) {
			const h = this.f.monsters.find((m) => m.uid === st.heldBy);
			const grabs =
				!!h &&
				!h.status.sealed &&
				mdef(h).abilities.some((a) => a.k === "grab");
			if (h && grabs && h.hp > 0 && dist(h, p) <= 1) {
				p.dir = dir;
				this.msg(`${monsterName(this, h)}に　足を　つかまれている！`, "warn");
				return true;
			}
			st.heldBy = null;
		}
		if (st.trapped > 0) {
			p.dir = dir;
			this.msg("トラばさみに　はさまれて　動けない", "warn");
			return true;
		}
		const d = this.confusedDir(dir);
		p.dir = d;
		const to = step(p, d);
		const m = this.monsterAt(to.x, to.y);
		if (m && this.cornerOk(p, d)) {
			this.emit({ t: "turn", id: PLAYER_ID, dir: d });
			if (m.disguise) {
				m.disguise = null;
				wakeMonster(this, m, true);
				this.msg(`${monsterName(this, m)}が　化けていた！`, "warn");
				return true;
			}
			// 混乱してよろけた先の敵は なぐってしまう
			if (st.confuse > 0) {
				this.playerAttack(m);
				return true;
			}
			// 見えない敵には ぶつかって 進めない（時間は進む）
			this.msg("なにかに　ぶつかった");
			return true;
		}
		if (!this.canStepTerrain(p, d)) {
			this.emit({ t: "turn", id: PLAYER_ID, dir: d });
			return st.confuse > 0; // 混乱で壁に向かったときは時間が進む
		}
		const from = { x: p.x, y: p.y };
		p.x = to.x;
		p.y = to.y;
		this.emit({ t: "move", id: PLAYER_ID, from, to, dir: d });
		this.afterStep(noPickup);
		return true;
	}

	/** 1歩動いたあと（拾う・罠）。 */
	afterStep(noPickup: boolean): void {
		const p = this.p;
		const fi = this.itemAt(p.x, p.y);
		if (fi) {
			if (noPickup) this.msg(`${this.name(fi.item)}の　上に　乗った`);
			else this.doPickup(false);
		}
		const trap = this.f.traps.find((t) => t.x === p.x && t.y === p.y);
		if (trap) triggerTrap(this, trap);
		if (this.onStairs() && !this.s.end) {
			// 階段に乗ったことは UI が見て、降りるか聞く
		}
	}

	/** 足元の道具を拾う。explicit は「ひろう」を選んだとき（拾えなくても時間は進む）。 */
	private doPickup(explicit: boolean): boolean {
		const p = this.p;
		const fi = this.itemAt(p.x, p.y);
		if (!fi) {
			if (explicit) this.msg("足元には　何もない");
			return false;
		}
		if (!this.addItem(fi.item)) {
			this.msg(`持ち物が　いっぱいで　${this.name(fi.item)}を　拾えない`);
			return explicit;
		}
		this.f.items = this.f.items.filter((i) => i !== fi);
		if (!this.s.seen.includes(fi.item.uid)) this.s.seen.push(fi.item.uid);
		this.se("item");
		this.msg(`${this.name(fi.item)}を　拾った`);
		this.onAcquire(fi.item);
		return true;
	}

	/** 持ち物に入った（拾った・交換した）。目的の品なら帰り道になる。 */
	private onAcquire(it: Item): void {
		if (it.kind === this.dungeon.goal && !this.s.returning) {
			this.s.returning = true;
			this.emit({ t: "goal" });
			this.msg(
				`${defOf(it.kind).name}を　手に入れた！　階段が　上り向きに　変わった`,
				"good",
			);
		}
	}

	private doDrop(uid: number): boolean {
		const it = this.findItem(uid);
		if (!it) return false;
		if (isKeyItem(it.kind)) {
			this.msg("これは　手放せない");
			return false;
		}
		if (this.isEquipped(it) && it.cursed) {
			this.msg(`${this.name(it)}は　のろわれていて　外せない！`, "warn");
			return false;
		}
		if (this.itemAt(this.p.x, this.p.y) || this.onStairs()) {
			this.msg("ここには　置けない");
			return false;
		}
		const ward = this.p.y * this.f.layout.w + this.p.x;
		if (this.f.wards.includes(ward)) {
			this.msg("ここには　置けない");
			return false;
		}
		this.removeItem(it);
		this.f.items.push({ x: this.p.x, y: this.p.y, item: it });
		this.msg(`${this.name(it)}を　置いた`);
		return true;
	}

	private doSwap(uid: number): boolean {
		const it = this.findItem(uid);
		const fi = this.itemAt(this.p.x, this.p.y);
		if (!it || !fi) return false;
		if (isKeyItem(it.kind)) {
			this.msg("これは　手放せない");
			return false;
		}
		if (this.isEquipped(it) && it.cursed) {
			this.msg(`${this.name(it)}は　のろわれていて　外せない！`, "warn");
			return false;
		}
		this.removeItem(it);
		this.f.items = this.f.items.filter((i) => i !== fi);
		this.addItem(fi.item); // 1つ空けたので必ず入る（矢は同じ種類にまとまる）
		this.f.items.push({ x: this.p.x, y: this.p.y, item: it });
		if (!this.s.seen.includes(fi.item.uid)) this.s.seen.push(fi.item.uid);
		this.se("item");
		this.msg(`${this.name(it)}と　${this.name(fi.item)}を　入れかえた`);
		this.onAcquire(fi.item);
		return true;
	}

	/** 装備する（のろわれた装備は外せない）。 */
	doEquip(uid: number): boolean {
		const p = this.p;
		const it = this.findItem(uid);
		if (!it) return false;
		const cat = defOf(it.kind).cat as ItemCat;
		const slot: "weapon" | "shield" | "ring" | "arrow" | null =
			cat === "weapon"
				? "weapon"
				: cat === "shield"
					? "shield"
					: cat === "ring"
						? "ring"
						: cat === "arrow"
							? "arrow"
							: null;
		if (!slot) return false;
		if (p[slot] === it.uid) return this.doUnequip(uid);
		const cur = this.findItem(p[slot] ?? -1);
		if (cur?.cursed) {
			this.msg(`${this.name(cur)}は　のろわれていて　外せない！`, "warn");
			return false;
		}
		if (slot === "ring") {
			if (cur) this.unsetRing();
			p.ring = it.uid;
			if (it.kind === "r_might") {
				this.applyMight(it.plus);
				it.known = true;
				if (identifyKind(this.s, it.kind))
					this.msg(`${this.name(it)}だった！`, "good");
			}
		} else {
			p[slot] = it.uid;
			it.known = true;
		}
		this.msg(`${this.name(it)}を　装備した`);
		if (it.cursed) {
			it.known = true;
			this.msg("のろわれていた！", "warn");
			this.se("damage");
		}
		return true;
	}

	private doUnequip(uid: number): boolean {
		const it = this.findItem(uid);
		if (!it || !this.isEquipped(it)) return false;
		if (it.cursed) {
			this.msg(`${this.name(it)}は　のろわれていて　外せない！`, "warn");
			return false;
		}
		if (this.p.ring === it.uid) {
			this.unsetRing();
			// 外せた＝のろわれていない、とわかった
			it.known = true;
		}
		if (this.p.weapon === it.uid) this.p.weapon = null;
		if (this.p.shield === it.uid) this.p.shield = null;
		if (this.p.arrow === it.uid) this.p.arrow = null;
		this.msg(`${this.name(it)}を　外した`);
		return true;
	}

	private doAttack(dir: Dir8): boolean {
		const p = this.p;
		const d = this.confusedDir(dir);
		p.dir = d;
		const to = step(p, d);
		const m = this.monsterAt(to.x, to.y);
		if (m && this.cornerOk(p, d)) {
			this.playerAttack(m);
			return true;
		}
		// 空ぶり：前のマスの罠を見つける
		this.emit({ t: "attack", id: PLAYER_ID, dir: d });
		this.se(this.weaponSound().swing);
		const trap = this.f.traps.find((t) => t.x === to.x && t.y === to.y);
		if (trap && !trap.found) {
			trap.found = true;
			this.msg("罠を　見つけた");
		}
		return true;
	}
}

/** モンスターの1回の行動にかかる時間（半ターン）。 */
const monsterCost = (m: Monster): number => {
	const d = mdef(m);
	const has = (k: string) =>
		!m.status.sealed && d.abilities.some((a) => a.k === k);
	let c = has("fastAct") ? 1 : has("slow") ? 4 : 2;
	if (m.status.fast > 0) c = 1;
	if (m.status.slow > 0) c = 4;
	return c;
};

/** モンスターハウスの階に札を寄せる（山札の総数は変えない。同じ層の中で配りなおす）。 */
const rebalanceForHouses = (
	rng: Rng,
	deal: string[][],
	houses: number[],
): void => {
	for (const h of houses) {
		// 同じ層（前後6階ぶん）の、ハウスでない階から 1枚ずつ引いてくる
		const donors = [];
		for (let d = Math.max(1, h - 3); d <= Math.min(deal.length - 1, h + 3); d++)
			if (d !== h && !houses.includes(d) && deal[d].length > 4) donors.push(d);
		rng.shuffle(donors);
		for (const d of donors.slice(0, 6)) {
			const i = rng.int(deal[d].length);
			deal[h].push(deal[d].splice(i, 1)[0]);
		}
	}
};

export { DOZE, HOLD };

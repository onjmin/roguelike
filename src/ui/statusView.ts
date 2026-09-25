// つよさ（レベル・HP・ちから・満腹度・経験値・攻撃と守り・装備・階とターン）。
//
// 攻撃は「素の攻撃力」（レベルと 武器の強さ＋ちから で決まる。ダメージはここから乱数と相手の守りで減る）。

import { attackPower, EXP_AT, HUNGER_UNIT, MAX_LV } from "../core/balance";
import { defOf } from "../core/item";
import type { Run } from "../core/run";
import type { Item } from "../core/types";
import type { Ctx } from "./ctx";
import { esc } from "./itemText";
import { infoWindow } from "./list";

const row = (k: string, v: string): string =>
	`<tr><td class="dim">${k}</td><td class="num">${v}</td></tr>`;

const statusHtml = (run: Run): string => {
	const s = run.s;
	const p = run.p;
	const st = p.status;
	const equip = (it: Item | null): string =>
		it ? esc(run.name(it)) : '<span class="dim">なし</span>';
	// 満腹度は 1/20% 単位で持っている。0% と出るのは本当に 0 のときだけにする
	const hunger = Math.ceil(p.hunger / HUNGER_UNIT);
	const next = p.lv < MAX_LV ? `${EXP_AT[p.lv] - p.exp}` : "−";
	const states = [
		st.sleep > 0 ? "眠り" : "",
		st.confuse > 0 ? "混乱" : "",
		st.blind > 0 ? "目が　見えない" : "",
		st.fast > 0 ? "倍速" : "",
		st.trapped > 0 ? "トラばさみ" : "",
		st.heldBy !== null ? "つかまれている" : "",
	].filter(Boolean);
	const floor = [
		run.f.senseMonsters ? "敵の　いる所" : "",
		run.f.senseItems ? "道具の　ある所" : "",
		run.f.sight ? "罠と　見えない敵" : "",
	].filter(Boolean);
	const rows = [
		row("レベル", String(p.lv)),
		row("HP", `${p.hp}/${p.maxHp}`),
		row("ちから", `${p.str}/${p.maxStr}`),
		row("満腹度", `${hunger}%`),
		row("経験値", String(p.exp)),
		row("次の　レベルまで", next),
		row("攻撃", String(attackPower(p.lv, run.meleePower()))),
		row("守り", String(run.playerDef())),
		row("状態", states.length ? states.join("・") : "ふつう"),
		'<tr><th colspan="2">装備</th></tr>',
		row("武器", equip(run.weapon())),
		row("盾", equip(run.shield())),
		row("指輪", equip(run.ring())),
		'<tr><th colspan="2">冒険</th></tr>',
		row("階", `${s.depth}階${s.returning ? "（帰り道）" : ""}`),
		row("ターン", String(s.turn)),
	];
	const out = [`<table>${rows.join("")}</table>`];
	if (floor.length)
		out.push(`<p class="hint">この階では　${floor.join("・")}が　わかる</p>`);
	if (s.returning)
		out.push(
			`<p class="hint">${esc(defOf(run.dungeon.goal).name)}を　持って　地上へ　もどろう</p>`,
		);
	return out.join("");
};

/** つよさ。 */
export const openStatus = (ctx: Ctx, run: Run): Promise<void> =>
	infoWindow(ctx, "つよさ", statusHtml(run));

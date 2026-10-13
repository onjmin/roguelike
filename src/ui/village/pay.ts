// 町の 有料の 寄り道（2026-10-14 作者：「他の 有料に して いい」）。
// 自販機・ドリンクバー・銭湯・映画館と 劇場・飲食店（2回目から）。払うのは キリコの 財布（engine/wallet.ts）。
// ゲームセンターの 筐体と 同じ 流れ：品書きに 値段 → 遊ぶ 直前に 払う（チャリン）→ 足りなければ 断って 何も しない。

import { devEvent } from "../../data/story/objectives";
import { PAY_SHORT } from "../../data/town/facilities";
import type { Story } from "../../engine/defs";
import { spendYen, walletYen, yen } from "../../engine/wallet";
import { previewStage } from "./villageReturn";
import { fill } from "./villageTalk";

/** 下見（?stage= / ?event=）の ときは 払っても 覚えない（この 回だけ）。 */
export const previewing = (): boolean =>
	previewStage() !== null || devEvent() !== null;

/** 払う（チャリン）。足りなければ 何も せず false。 */
export const pay = (s: Story, price: number): boolean => {
	if (!spendYen(price, previewing())) return false;
	s.se("arcCoin");
	return true;
};

/** 払う。足りなければ 地の文「お金が　たりない。」で 断って false。 */
export const payOrShort = async (s: Story, price: number): Promise<boolean> => {
	if (pay(s, price)) return true;
	await s.narrate(
		fill(PAY_SHORT, { price: yen(price), have: yen(walletYen()) }),
	);
	return false;
};

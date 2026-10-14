// 同行者を 決める（筋で 決まる ゲスト。core/guest.ts）。選ばない・連れていく 人は 板と 筋で 1人に 決まる。
// その 板を まだ 持ち帰って いない あいだだけ（話の 中の 冒険だけ。持ち帰った あとの 板は いつもどおり ひとり）。
// やきうは 連れていかない（「上で　保守しとく」人。STORY.md §5.9）。
// 同行者が 主人公（ゼロ）と 同じ 人なら 連れていかない。村に まだ いない 人も 連れていかない。

import type { HeroId } from "../../core/data/heroes";
import type { DungeonId, GuestId } from "../../core/types";
import type { Speaker } from "../story/quotes";
import { awayFriends } from "../story/story";

type GuestPlan = {
	who: GuestId;
	/** 村で ついてくる ときの 地の文と ひとこと（出発の 前）。 */
	join: string;
	line: string;
	/** 仲間なら 村に いるかを 見る（原住民は 住人なので 灯台の あとから 村に いる）。 */
	speaker?: Speaker;
	/** 村に いる ための 板（住人）。 */
	after?: DungeonId;
};

export const GUEST_PLAN: Partial<Record<DungeonId, GuestPlan>> = {
	// 最終話：1000まで 数えるのが 夢の ゼロが、鉄塔まで
	deep: {
		who: "zero",
		speaker: "zero",
		join: "ゼロが　かけよってきた。",
		line: "ゼロも　行きます。\n1000まで、近くで　数えたいんです",
	},
	// 離島板：飛べるけど 飛ばない フェリスが、歩いて 島へ
	tropical: {
		who: "feris",
		speaker: "feris",
		join: "フェリスが　ぱたぱた　ついてきた。",
		line: "島、いっしょに　歩こ〜。\n……飛ばないで　行って　みたいの〜",
	},
	// 野球chの 跡地（裏）：>>1 を 書いた 原住民が 案内する
	ato: {
		who: "shobon",
		after: "opunu",
		join: "原住民が　梯子の　前で　待っていた。",
		line: "……おれも　行く。\n>>1の　場所、知ってるから",
	},
};

/** この 冒険に ついてくる 同行者（いなければ null）。 */
export const guestFor = (
	d: DungeonId,
	cleared: readonly DungeonId[],
	stage: number,
	hero: HeroId,
): GuestPlan | null => {
	const plan = GUEST_PLAN[d];
	if (!plan || cleared.includes(d)) return null;
	if (plan.who === hero) return null;
	if (plan.speaker && awayFriends(cleared, stage).includes(plan.speaker))
		return null;
	if (plan.after && !cleared.includes(plan.after)) return null;
	return plan;
};

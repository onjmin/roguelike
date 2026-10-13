// 立ち絵の 顔の 位置（ui/message.ts が これで 大きさと 位置を そろえる）。
// どの 絵も 頭の 大きさ（頭の てっぺん〜あご）が 同じに なり、てっぺんが 同じ 高さ、顔の 真ん中が 枠の 真ん中に 来る。
// 値は 元の PNG（1024×1024）の px。てっぺんは 髪の 上（耳・アホ毛・帽子・リボンは 入れない）。
// 無い 絵は 自動で 測る（いちばん 上の 不透明な 行を てっぺん・全身の 2割下を あごと みなす）ので、ずれやすい。
// 新しい 絵を 入れたら ここにも 足す。

export type PortraitHead = {
	/** 顔の 横の 真ん中（目と 口の あいだ）。 */
	x: number;
	/** 頭の てっぺん（髪の 上）。 */
	top: number;
	/** あご。 */
	chin: number;
};

export const PORTRAIT_HEAD: Record<string, PortraitHead> = {
	"portraits/roze.png": { x: 522, top: 182, chin: 335 },
	"portraits/shiyo.png": { x: 468, top: 125, chin: 290 },
	"portraits/zero.png": { x: 525, top: 125, chin: 318 },
	"portraits/feris.png": { x: 507, top: 110, chin: 262 },
	"portraits/kiriko.png": { x: 540, top: 115, chin: 292 },
	"portraits/rino.png": { x: 508, top: 95, chin: 268 },
	"portraits/aru.png": { x: 500, top: 25, chin: 165 },
	"portraits/zero_proto.png": { x: 518, top: 95, chin: 300 },
	"portraits/zero_ren.png": { x: 505, top: 95, chin: 320 },
	"portraits/hinary.png": { x: 522, top: 10, chin: 215 },
};

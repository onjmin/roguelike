// キリコの 家の 遊べる 家具の ゲームの 試験を まとめる（src/sim/arcadeTests.ts から）。

import { tests as crossing } from "./crossing";
import { tests as gomoku } from "./gomoku";
import { tests as grass } from "./grass";
import { tests as hasami } from "./hasami";
import { tests as kingyo } from "./kingyo";
import type { HomeGameTest } from "./kit";
import { tests as kurohige } from "./kurohige";
import { tests as mines } from "./mines";
import { tests as pong } from "./pong";
import { tests as simon } from "./simon";
import { tests as snake } from "./snake";
import { tests as stack } from "./stack";
import { tests as taiko } from "./taiko";

export const HOME_GAME_TESTS: readonly HomeGameTest[] = [
	...snake,
	...stack,
	...crossing,
	...gomoku,
	...hasami,
	...mines,
	...grass,
	...taiko,
	...simon,
	...pong,
	...kurohige,
	...kingyo,
];

// キリコの 家の 遊べる 家具の ゲームの 試験を まとめる（src/sim/arcadeTests.ts から）。

import { tests as baccarat } from "./baccarat";
import { tests as blackjack } from "./blackjack";
import { tests as clicker } from "./clicker";
import { tests as crane } from "./crane";
import { tests as crossing } from "./crossing";
import { tests as danmaku } from "./danmaku";
import { tests as darts } from "./darts";
import { tests as digkiriko } from "./digkiriko";
import { tests as doom } from "./doom";
import { tests as gomoku } from "./gomoku";
import { tests as grass } from "./grass";
import { tests as hasami } from "./hasami";
import { tests as kingyo } from "./kingyo";
import type { HomeGameTest } from "./kit";
import { tests as koikoi } from "./koikoi";
import { tests as kurohige } from "./kurohige";
import { tests as mines } from "./mines";
import { tests as mojisagashi } from "./mojisagashi";
import { tests as net } from "./net";
import { tests as nineball } from "./nineball";
import { tests as pachinko } from "./pachinko";
import { tests as paint } from "./paint";
import { tests as patapata } from "./patapata";
import { tests as petitcon } from "./petitcon";
import { tests as picross } from "./picross";
import { tests as pinball } from "./pinball";
import { tests as poker } from "./poker";
import { tests as pong } from "./pong";
import { tests as purikura } from "./purikura";
import { tests as puyupuyu } from "./puyupuyu";
import { tests as resukui } from "./resukui";
import { tests as reversi } from "./reversi";
import { tests as simon } from "./simon";
import { tests as snake } from "./snake";
import { tests as soko } from "./soko";
import { tests as stack } from "./stack";
import { tests as taiko } from "./taiko";
import { tests as tsuribori } from "./tsuribori";
import { tests as wangan } from "./wangan";

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
	...puyupuyu,
	...pinball,
	...danmaku,
	...mojisagashi,
	...clicker,
	...doom,
	...resukui,
	...digkiriko,
	...patapata,
	...reversi,
	...koikoi,
	...picross,
	...soko,
	...nineball,
	...darts,
	...tsuribori,
	...poker,
	...blackjack,
	...baccarat,
	...pachinko,
	...petitcon,
	...wangan,
	...crane,
	...purikura,
	...paint,
	...net,
];

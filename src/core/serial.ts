// 冒険の状態 ⇔ JSON 文字列（中断セーブ用）。
//
// マップの配列（Uint8Array / Int16Array）はそのままだと JSON にできないので、
// 文字列に詰めて保存し、読むときに戻す。

import type { Layout } from "./mapgen";
import type { Floor, RunState } from "./types";

const bytesToStr = (a: Uint8Array): string => {
	let s = "";
	for (let i = 0; i < a.length; i++) s += String.fromCharCode(48 + a[i]);
	return s;
};

const strToBytes = (s: string): Uint8Array => {
	const a = new Uint8Array(s.length);
	for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) - 48;
	return a;
};

type LayoutJson = Omit<Layout, "tiles" | "roomOf"> & {
	tiles: string;
	roomOf: number[];
};
type FloorJson = Omit<Floor, "layout" | "seen"> & {
	layout: LayoutJson;
	seen: string;
};
type RunJson = Omit<RunState, "floor"> & { floor: FloorJson };

export const serializeRun = (s: RunState): string => {
	const { layout, seen, ...floorRest } = s.floor;
	const floor: FloorJson = {
		...floorRest,
		layout: {
			...layout,
			tiles: bytesToStr(layout.tiles),
			roomOf: Array.from(layout.roomOf),
		},
		seen: bytesToStr(seen),
	};
	const json: RunJson = { ...s, floor };
	return JSON.stringify(json);
};

export const deserializeRun = (text: string): RunState => {
	const json = JSON.parse(text) as RunJson;
	const { layout, seen, ...floorRest } = json.floor;
	const floor: Floor = {
		...floorRest,
		layout: {
			...layout,
			tiles: strToBytes(layout.tiles),
			roomOf: Int16Array.from(layout.roomOf),
		},
		seen: strToBytes(seen),
	};
	return { ...json, floor };
};

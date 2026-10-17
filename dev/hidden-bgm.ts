// 過去ログの底の 層ごとの 曲を 一覧で 試聴する（開発用。pnpm dev で /dev/hidden-bgm.html）。
// 曲は ゲームと 同じ MML を gzip → base64url にして、dtm の 公開デモ（埋めこみ プレイヤー）の # に 渡す
// （# の 中身は サーバーに 送られない）。層の 並びと 曲は data/story/story.ts の BOARD_LOOKS.hidden.zones。

import { bgm } from "../src/data/audio/bgm";
import { BOARD_LOOKS } from "../src/data/story/story";

const EMBED = "https://onjmin.github.io/dtm/demo/embed.html#g.";

const gzipBase64Url = async (text: string): Promise<string> => {
	const stream = new Blob([text])
		.stream()
		.pipeThrough(new CompressionStream("gzip"));
	const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
	let bin = "";
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
};

const list = document.getElementById("list") as HTMLElement;
const zones = BOARD_LOOKS.hidden.zones ?? [];
let from = 1;
for (const z of zones) {
	const box = document.createElement("div");
	box.className = "zone";
	const floors = from === z.last ? `B${z.last}` : `B${from}〜${z.last}`;
	box.innerHTML = `<div class="head"><span class="floors">${floors}</span><span class="name"></span><span class="bgm"></span></div><div class="note"></div>`;
	(box.querySelector(".name") as HTMLElement).textContent = z.name;
	(box.querySelector(".bgm") as HTMLElement).textContent = z.bgm;
	(box.querySelector(".note") as HTMLElement).textContent = z.note ?? "";
	const mml = bgm[z.bgm];
	if (mml) {
		const frame = document.createElement("iframe");
		frame.loading = "lazy";
		frame.allow = "autoplay";
		frame.src = EMBED + (await gzipBase64Url(mml));
		box.appendChild(frame);
	}
	list.appendChild(box);
	from = z.last + 1;
}

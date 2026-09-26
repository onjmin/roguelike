// リプレイを 人に わたす 窓（共有コードの 作り方・読み方は engine/share.ts）。
// - 共有：リンクを 見せて、コピー／ファイルに 保存。
// - 読み込む：貼りつけるか ファイルを 選ぶ。
// - もらった リプレイを 見るか 聞く（版が ちがえば 知らせる）。

import { DUNGEON_NAMES } from "../data/story";
import type { SavedReplay } from "../engine/save";
import {
	decodeShare,
	encodeShare,
	saveTextFile,
	shareFileName,
	shareUrl,
} from "../engine/share";
import type { Ctx } from "./ctx";
import { el } from "./dom";
import { listWindow, markOpened, onTap } from "./list";
import { esc } from "./records";

/** もらった リプレイの 見出し（どこで どう 終わったか）。 */
const sharedHead = (rp: SavedReplay): string => {
	const where = DUNGEON_NAMES[rp.dungeon ?? "main"].short;
	const how =
		rp.kind === "clear"
			? "持ち帰った"
			: rp.kind === "escape"
				? `B${rp.depth}から　帰還スレで　もどった`
				: `B${rp.depth}で　${esc(rp.cause)}`;
	return `${esc(where)}　${how}<br><small>${rp.turn}ターン</small>`;
};

/** 前の版で 遊んだ リプレイか（今の版だけで 遊んだ ものでなければ ずれうる）。 */
export const isOldReplay = (rp: SavedReplay): boolean =>
	rp.builds.some((b) => b !== __CORE_VERSION__);

export const OLD_REPLAY_WARN = `<small class="warn">前の版で　遊んだ冒険です。途中から　ずれて、最後まで　見られない　ことが　あります</small>`;

/** もらった リプレイを 見るか 聞く。 */
export const confirmShared = async (
	ctx: Ctx,
	rp: SavedReplay,
): Promise<boolean> => {
	const pick = await listWindow(
		ctx,
		`もらった　リプレイ<br>${sharedHead(rp)}${isOldReplay(rp) ? `<br>${OLD_REPLAY_WARN}` : ""}`,
		[{ label: "リプレイを　見る", value: "play" }],
	);
	return pick === "play";
};

/**
 * テキストの 窓（共有と 読み込みで 使う）。B・とじる で 閉じる。
 * 中の ボタンは onTap で つなぐ（textarea は 打てるように そのまま）。
 */
const textWindow = (
	ctx: Ctx,
	title: string,
	build: (box: HTMLElement, done: () => void) => void,
): Promise<void> =>
	new Promise((resolve) => {
		const box = el("div", { class: "menu window share" });
		box.appendChild(el("div", { class: "menu-title", html: title }));
		const close = el("button", { class: "menu-close", text: "とじる" });
		const done = () => {
			pop();
			ctx.se("cancel");
			box.remove();
			resolve();
		};
		build(box, done);
		onTap(close, box, done);
		box.appendChild(close);
		ctx.ui.appendChild(box);
		markOpened(box);
		const pop = ctx.input.push(
			(k, repeat) => {
				if (k === "b" && !repeat) done();
			},
			{ tap: "b" },
		);
	});

const actionBtn = (label: string): HTMLButtonElement =>
	el("button", { class: "menu-close menu-action", text: label });

/** リプレイを 人に わたす：リンクを 見せて、コピー／ファイルに 保存。 */
export const shareWindow = async (ctx: Ctx, rp: SavedReplay): Promise<void> => {
	const url = shareUrl(await encodeShare(rp));
	await textWindow(ctx, "リプレイを　わたす", (box) => {
		const area = el("textarea", { class: "share-text" });
		area.readOnly = true;
		area.value = url;
		const note = el("div", {
			class: "share-note",
			html: `リンクを　開くと　見られます（${url.length.toLocaleString()}文字）<br><small>長くて　貼れない　ときは　ファイルで　わたしてね</small>`,
		});
		const copy = actionBtn("コピー");
		const file = actionBtn("ファイルに　保存");
		onTap(copy, box, () => {
			area.select();
			const ok = () => {
				ctx.se("decide");
				copy.textContent = "コピーした";
			};
			if (navigator.clipboard?.writeText)
				navigator.clipboard.writeText(url).then(ok, () => {
					document.execCommand("copy") && ok();
				});
			else if (document.execCommand("copy")) ok();
		});
		onTap(file, box, () => {
			ctx.se("decide");
			saveTextFile(shareFileName(rp), url);
		});
		area.addEventListener("focus", () => area.select());
		box.append(area, note, el("div", { class: "menu-foot" }, [copy, file]));
	});
};

/** もらった リプレイを 読み込む：貼りつけるか ファイルを 選ぶ。見るなら そのリプレイを 返す。 */
export const importWindow = async (ctx: Ctx): Promise<SavedReplay | null> => {
	const got: { rp: SavedReplay | null } = { rp: null };
	await textWindow(ctx, "リプレイを　読み込む", (box, done) => {
		const area = el("textarea", { class: "share-text" });
		area.placeholder = "もらった　リンクを　ここに　貼りつける";
		const note = el("div", { class: "share-note" });
		const input = el("input");
		input.type = "file";
		input.accept = ".txt,text/plain";
		input.hidden = true;
		const pick = actionBtn("ファイルから");
		const go = actionBtn("見る");
		const tryText = async (text: string) => {
			const rp = await decodeShare(text);
			if (!rp) {
				ctx.se("cancel");
				note.innerHTML = `<small class="warn">読めませんでした。リンクを　ぜんぶ　貼りつけて　ね</small>`;
				return;
			}
			got.rp = rp;
			done();
		};
		onTap(pick, box, () => input.click());
		input.addEventListener("change", () => {
			const f = input.files?.[0];
			input.value = "";
			if (f) void f.text().then(tryText);
		});
		onTap(go, box, () => void tryText(area.value));
		box.append(
			area,
			note,
			input,
			el("div", { class: "menu-foot" }, [pick, go]),
		);
	});
	if (got.rp && (await confirmShared(ctx, got.rp))) return got.rp;
	return null;
};

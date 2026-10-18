// スタッフロール：黒い 幕の 上を 役と 名前が 下から 上へ 流れ、流れきったら 題と 締めの 一行が 出る。
// 押して いる あいだ（画面・キー）は 4倍で 流れる。題が 出てから 少し 待って おわる。
// おわっても 幕は 黒い まま 残す（呼ぶ側が 画面を 暗くしてから close で 消す。下の 村が 一瞬 見えない ように）。
// 見た目だけ（保存・乱数に さわらない）。画面の ない ところ（シミュレーション）では すぐ おわる。

export type StaffRollSpec = {
	blocks: readonly { role?: string; names: readonly string[] }[];
	title: string;
	after?: string;
};

/** 流れる 速さ（px/秒）と、押して いる ときの 倍率。 */
const SPEED = 42;
const FAST = 4;

const el = (cls: string, text?: string): HTMLElement => {
	const d = document.createElement("div");
	d.className = cls;
	if (text !== undefined) d.textContent = text;
	return d;
};

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** ロールを 流す。おわると 幕を 消す 関数を かえす。 */
export const rollStaff = async (
	root: HTMLElement | null,
	spec: StaffRollSpec,
): Promise<() => void> => {
	if (!root || typeof document === "undefined") return () => {};
	const box = el("staff-roll");
	const list = el("staff-roll-list");
	for (const b of spec.blocks) {
		const blk = el("staff-roll-block");
		if (b.role) blk.appendChild(el("staff-roll-role", b.role));
		for (const n of b.names) blk.appendChild(el("staff-roll-name", n));
		list.appendChild(blk);
	}
	const end = el("staff-roll-end");
	end.appendChild(el("staff-roll-title", spec.title));
	if (spec.after) end.appendChild(el("staff-roll-after", spec.after));
	box.append(list, end);
	root.appendChild(box);
	void box.offsetWidth;
	box.classList.add("on");

	// 押して いる あいだ 速く
	let held = 0;
	const down = () => {
		held++;
	};
	const up = () => {
		held = 0;
	};
	box.addEventListener("pointerdown", down);
	window.addEventListener("pointerup", up);
	window.addEventListener("keydown", down);
	window.addEventListener("keyup", up);

	await new Promise<void>((done) => {
		let y = box.clientHeight;
		let last = performance.now();
		const step = (now: number) => {
			const dt = Math.min(0.1, (now - last) / 1000);
			last = now;
			y -= SPEED * (held ? FAST : 1) * dt;
			list.style.transform = `translateY(${Math.round(y)}px)`;
			if (y + list.offsetHeight < 0 || !box.isConnected) done();
			else requestAnimationFrame(step);
		};
		requestAnimationFrame(step);
	});
	end.classList.add("on");
	await sleep(4500);

	box.removeEventListener("pointerdown", down);
	window.removeEventListener("pointerup", up);
	window.removeEventListener("keydown", down);
	window.removeEventListener("keyup", up);
	return () => box.remove();
};

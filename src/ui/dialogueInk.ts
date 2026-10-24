const INK = {
	青字: "#58baff",
	赤字: "#ff7373",
} as const;

export type DialogueInk = {
	text: string;
	color?: string;
};

export const dialogueInk = (source: string): DialogueInk => {
	let text = source;
	let color: string | undefined;
	let marks = 0;
	while (true) {
		const mark = /^(【青字】|【赤字】)/u.exec(text)?.[0];
		if (!mark) break;
		color = INK[mark === "【青字】" ? "青字" : "赤字"];
		text = text.slice(mark.length);
		marks++;
	}
	if (!text && marks) text = "■".repeat(marks);
	return { text, color };
};

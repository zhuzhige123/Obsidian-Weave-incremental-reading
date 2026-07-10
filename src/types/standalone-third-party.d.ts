declare module "pako" {
	export function inflateRaw(
		data: Uint8Array | ArrayBuffer | number[],
		options?: { to?: "string" | string },
	): Uint8Array | string;
}

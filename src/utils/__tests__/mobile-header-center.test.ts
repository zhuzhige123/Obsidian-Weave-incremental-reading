import { computeMobileHeaderCenterTop } from "../mobile-header-center";

describe("computeMobileHeaderCenterTop", () => {
	it("使用可见头栏按钮的中位中心线来计算顶部圆点位置", () => {
		const top = computeMobileHeaderCenterTop(
			{ top: 100, height: 56 },
			[
				{ top: 112, bottom: 144, width: 32, height: 32 },
				{ top: 110, bottom: 142, width: 32, height: 32 },
				{ top: 112, bottom: 144, width: 32, height: 32 },
			]
		);

		expect(top).toBe(28);
	});

	it("忽略无效按钮矩形，并在没有有效按钮时返回 null", () => {
		expect(
			computeMobileHeaderCenterTop(
				{ top: 100, height: 56 },
				[{ top: 110, bottom: 110, width: 0, height: 0 }]
			)
		).toBeNull();
	});

	it("使用中位数抵抗异常偏移按钮，避免圆点被单个异常元素带偏", () => {
		const top = computeMobileHeaderCenterTop(
			{ top: 100, height: 56 },
			[
				{ top: 112, bottom: 144, width: 32, height: 32 },
				{ top: 112, bottom: 144, width: 32, height: 32 },
				{ top: 92, bottom: 124, width: 32, height: 32 },
			]
		);

		expect(top).toBe(28);
	});
});

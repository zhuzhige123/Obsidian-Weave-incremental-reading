import { describe, expect, test } from "vitest";
import {
	IRCALENDAR_SCHEDULING_MENU_ACTIONS,
	sortSchedulingMenuActionsByDueDate,
} from "../ir-calendar-scheduling-menu-types";

describe("sortSchedulingMenuActionsByDueDate", () => {
	test("sorts arrange actions by due date and keeps postpone last", () => {
		const sorted = sortSchedulingMenuActionsByDueDate(
			IRCALENDAR_SCHEDULING_MENU_ACTIONS,
			{
				intensive: 8,
				normal: 15,
				slow: 27,
				postpone: -9,
			},
		);

		expect(sorted).toEqual(["intensive", "normal", "slow", "postpone"]);
	});

	test("reorders intensive and slow by due date while keeping postpone last", () => {
		const sorted = sortSchedulingMenuActionsByDueDate(
			IRCALENDAR_SCHEDULING_MENU_ACTIONS,
			{
				intensive: 27,
				normal: 15,
				slow: 8,
				postpone: 17,
			},
		);

		expect(sorted).toEqual(["slow", "normal", "intensive", "postpone"]);
	});
});

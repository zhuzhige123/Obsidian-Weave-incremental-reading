import { describe, expect, test } from "vitest";
import {
	IRCALENDAR_SCHEDULING_MENU_ACTIONS,
	sortSchedulingMenuActionsByDueDate,
} from "../ir-calendar-scheduling-menu-types";

describe("sortSchedulingMenuActionsByDueDate", () => {
	test("puts postpone immediately after normal and sorts others by due date", () => {
		const sorted = sortSchedulingMenuActionsByDueDate(
			IRCALENDAR_SCHEDULING_MENU_ACTIONS,
			{
				intensive: 8,
				normal: 15,
				slow: 27,
				postpone: -9,
			},
		);

		expect(sorted).toEqual(["intensive", "normal", "postpone", "slow"]);
	});

	test("reorders intensive and slow by due date while keeping postpone after normal", () => {
		const sorted = sortSchedulingMenuActionsByDueDate(
			IRCALENDAR_SCHEDULING_MENU_ACTIONS,
			{
				intensive: 27,
				normal: 15,
				slow: 8,
				postpone: 17,
			},
		);

		expect(sorted).toEqual(["slow", "normal", "postpone", "intensive"]);
	});
});

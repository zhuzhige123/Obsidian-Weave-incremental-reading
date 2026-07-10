export interface ImpactedPreviewItem {
	id: string;
	title: string;
	beforeDateText: string;
	afterDateText: string;
}

export interface PreviewDayDelta {
	dateKey: string;
	beforeMinutes: number;
	afterMinutes: number;
}

export interface PreviewDetails {
	headline: string;
	beforeDateText: string;
	afterDateText: string;
	changedItemCount: number;
	impactedDays: number;
	impactedItems: ImpactedPreviewItem[];
	dayDeltas: PreviewDayDelta[];
}

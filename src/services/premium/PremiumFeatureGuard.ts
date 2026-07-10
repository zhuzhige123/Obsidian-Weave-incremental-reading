/**
 * 高级功能守卫服务
 * 单例模式，管理高级功能的访问控制
 */

import { type Writable, get, writable } from "svelte/store";
import type {
	EffectiveLicenseState,
	LicenseInfo,
	LicensedProduct,
} from "../../types/license";
import {
	LICENSED_PRODUCTS,
	resolveEffectiveLicenseState,
} from "../../utils/license-state";
import { licenseManager } from "../../utils/licenseManager";
import {
	IR_FEATURE_METADATA,
	IR_PREMIUM_BENEFIT_FEATURE_ORDER,
	IR_PREMIUM_FEATURES,
	IR_PREMIUM_ONLY_FEATURE_IDS,
} from "./ir-premium-features";

declare const __WEAVE_IR_STANDALONE__: boolean;

const isIrStandalone =
	typeof __WEAVE_IR_STANDALONE__ !== "undefined" && __WEAVE_IR_STANDALONE__;

/** 独立 IR 插件对外暴露的高级功能 ID（仅增量阅读相关）。 */
export const PREMIUM_FEATURES = isIrStandalone
	? IR_PREMIUM_FEATURES
	: IR_PREMIUM_FEATURES;

export const FEATURE_METADATA = isIrStandalone
	? IR_FEATURE_METADATA
	: IR_FEATURE_METADATA;

export const PREMIUM_BENEFIT_FEATURE_ORDER = isIrStandalone
	? IR_PREMIUM_BENEFIT_FEATURE_ORDER
	: IR_PREMIUM_BENEFIT_FEATURE_ORDER;

const PREMIUM_ONLY_FEATURE_IDS = isIrStandalone
	? IR_PREMIUM_ONLY_FEATURE_IDS
	: IR_PREMIUM_ONLY_FEATURE_IDS;

/**
 * 高级功能守卫类
 * 单例模式，管理许可证验证和功能访问控制
 */
export class PremiumFeatureGuard {
	private static instance: PremiumFeatureGuard;
	private currentProduct: LicensedProduct = LICENSED_PRODUCTS.WEAVE;
	private localLicenses: LicenseInfo[] = [];
	private inheritedLicenses: LicenseInfo[] = [];
	private effectiveState: EffectiveLicenseState = resolveEffectiveLicenseState({
		product: LICENSED_PRODUCTS.WEAVE,
	});

	/**
	 * 高级版状态 Store
	 * 用于响应式更新UI
	 */
	public isPremiumActive: Writable<boolean>;

	/**
	 * 是否显示高级功能预览入口
	 * 兼容新版 UI 的公开分支降级实现
	 */
	public premiumFeaturesPreviewEnabled: Writable<boolean>;

	/**
	 * 验证缓存
	 * 避免频繁验证许可证
	 */
	private validationCache: {
		isValid: boolean;
		timestamp: number;
	} | null = null;

	/**
	 * 缓存有效期：5分钟
	 */
	private readonly CACHE_DURATION = 5 * 60 * 1000;

	/**
	 * 私有构造函数，确保单例
	 */
	private constructor() {
		this.isPremiumActive = writable(false);
		this.premiumFeaturesPreviewEnabled = writable(false);
	}

	/**
	 * 获取单例实例
	 */
	static getInstance(): PremiumFeatureGuard {
		if (!PremiumFeatureGuard.instance) {
			PremiumFeatureGuard.instance = new PremiumFeatureGuard();
		}
		return PremiumFeatureGuard.instance;
	}

	/**
	 * 用本地许可证元数据快速推导高级功能状态，避免启动时阻塞在指纹/云端校验。
	 */
	primeLicenseState(input: {
		product: LicensedProduct;
		localLicenses?: LicenseInfo[];
		inheritedLicenses?: LicenseInfo[];
	}): void {
		this.currentProduct = input.product;
		this.localLicenses = input.localLicenses ?? [];
		this.inheritedLicenses = input.inheritedLicenses ?? [];
		const effectiveState = resolveEffectiveLicenseState({
			product: this.currentProduct,
			localLicenses: this.localLicenses,
			inheritedLicenses: this.inheritedLicenses,
		});
		this.effectiveState = effectiveState;
		this.isPremiumActive.set(effectiveState.isPremiumActive);
	}

	/**
	 * 初始化守卫
	 */
	async initializeForProduct(input: {
		product: LicensedProduct;
		localLicenses?: LicenseInfo[];
		inheritedLicenses?: LicenseInfo[];
	}): Promise<void> {
		this.primeLicenseState(input);
		const effectiveState = await this.validateLicenseState();
		this.effectiveState = effectiveState;
		this.isPremiumActive.set(effectiveState.isPremiumActive);
	}

	/**
	 * 更新许可证状态
	 */
	async updateLicenseState(input: {
		product?: LicensedProduct;
		localLicenses?: LicenseInfo[];
		inheritedLicenses?: LicenseInfo[];
	}): Promise<void> {
		this.clearCache();
		this.currentProduct = input.product ?? this.currentProduct;
		this.localLicenses = input.localLicenses ?? this.localLicenses;
		this.inheritedLicenses = input.inheritedLicenses ?? this.inheritedLicenses;
		const effectiveState = await this.validateLicenseState();
		this.effectiveState = effectiveState;
		this.isPremiumActive.set(effectiveState.isPremiumActive);
	}

	getEffectiveState(): EffectiveLicenseState {
		return this.effectiveState;
	}

	/**
	 * 设置是否显示高级功能预览入口
	 */
	setPremiumFeaturesPreview(enabled: boolean): void {
		this.premiumFeaturesPreviewEnabled.set(enabled);
	}

	/**
	 * 判断一个功能是否属于高级功能
	 */
	isPremiumFeature(featureId: string): boolean {
		return PREMIUM_ONLY_FEATURE_IDS.has(featureId);
	}

	/**
	 * 判断当前 UI 是否应该展示某个功能入口
	 * 已激活用户始终展示；未激活用户仅在开启预览时展示高级功能入口。
	 */
	shouldShowFeatureEntry(
		featureId: string,
		options?: {
			isPremium?: boolean;
			showPremiumPreview?: boolean;
		},
		context?: PremiumFeatureAccessContext,
	): boolean {
		if (!this.isPremiumFeature(featureId)) {
			return true;
		}

		if (this.isLimitedTimeFeatureOpen(featureId, context)) {
			return true;
		}

		const isPremium = options?.isPremium ?? get(this.isPremiumActive);
		if (isPremium) {
			return true;
		}

		const showPremiumPreview =
			options?.showPremiumPreview ?? get(this.premiumFeaturesPreviewEnabled);
		return showPremiumPreview;
	}

	/**
	 * 检查是否可以使用某个功能
	 * @param featureId 功能ID
	 * @returns true表示可以使用
	 */
	canUseFeature(
		featureId: string,
		context?: PremiumFeatureAccessContext,
	): boolean {
		const isPremium = get(this.isPremiumActive);

		// 基础功能完全免费，不受许可证限制
		if (this.isLimitedTimeFeatureOpen(featureId, context)) {
			return true;
		}

		// 检查是否为高级功能
		if (this.isPremiumFeature(featureId)) {
			return isPremium;
		}

		// 非高级功能，所有人都可以使用
		return true;
	}

	/**
	 * 检查功能是否受限（canUseFeature的反向）
	 * @param featureId 功能ID
	 * @returns true表示功能受限，不可使用
	 */
	isFeatureRestricted(
		featureId: string,
		context?: PremiumFeatureAccessContext,
	): boolean {
		return !this.canUseFeature(featureId, context);
	}

	isFeatureLimitedTimeOpen(
		featureId: string,
		context?: PremiumFeatureAccessContext,
	): boolean {
		return this.isLimitedTimeFeatureOpen(featureId, context);
	}

	canUseAnyFeature(
		featureIds: string[],
		context?: PremiumFeatureAccessContext,
	): boolean {
		return featureIds.some((featureId) =>
			this.canUseFeature(featureId, context),
		);
	}

	shouldShowAnyFeatureEntry(
		featureIds: string[],
		options?: {
			isPremium?: boolean;
			showPremiumPreview?: boolean;
		},
		context?: PremiumFeatureAccessContext,
	): boolean {
		return featureIds.some((featureId) =>
			this.shouldShowFeatureEntry(featureId, options, context),
		);
	}

	getAnyFeatureEntryTitle(
		baseTitle: string,
		featureIds: string[],
		context?: PremiumFeatureAccessContext,
	): string {
		if (get(this.isPremiumActive)) {
			return baseTitle;
		}

		if (
			featureIds.some((featureId) =>
				this.isLimitedTimeFeatureOpen(featureId, context),
			)
		) {
			return `${baseTitle} ⏱`;
		}

		return this.canUseAnyFeature(featureIds, context)
			? baseTitle
			: `${baseTitle} 🔒`;
	}

	getFeatureEntryTitle(
		baseTitle: string,
		featureId: string,
		context?: PremiumFeatureAccessContext,
	): string {
		if (get(this.isPremiumActive)) {
			return baseTitle;
		}

		if (this.isLimitedTimeFeatureOpen(featureId, context)) {
			return `${baseTitle} ⏱`;
		}

		return this.canUseFeature(featureId, context)
			? baseTitle
			: `${baseTitle} 🔒`;
	}

	/**
	 * 验证许可证
	 * 使用缓存优化性能
	 */
	private async validateLicenseState(): Promise<EffectiveLicenseState> {
		if (this.validationCache) {
			const now = Date.now();
			if (now - this.validationCache.timestamp < this.CACHE_DURATION) {
				return this.effectiveState;
			}
		}

		const validatedLocalLicenses: LicenseInfo[] = [];
		for (const license of this.localLicenses) {
			const validation = await licenseManager.validateCurrentLicense(license, {
				targetProduct: this.currentProduct,
			});
			if (validation.isValid) {
				validatedLocalLicenses.push(license);
			}
		}

		const validatedInheritedLicenses: LicenseInfo[] = [];
		for (const license of this.inheritedLicenses) {
			const validation = await licenseManager.validateCurrentLicense(license, {
				targetProduct: this.currentProduct,
			});
			if (validation.isValid) {
				validatedInheritedLicenses.push(license);
			}
		}

		const effectiveState = resolveEffectiveLicenseState({
			product: this.currentProduct,
			localLicenses: validatedLocalLicenses,
			inheritedLicenses: validatedInheritedLicenses,
		});

		this.validationCache = {
			isValid: effectiveState.isPremiumActive,
			timestamp: Date.now(),
		};

		return effectiveState;
	}

	/**
	 * 清除验证缓存
	 */
	private clearCache(): void {
		this.validationCache = null;
	}

	private isContextMatched(
		context: PremiumFeatureAccessContext | undefined,
		matcher: PremiumFeatureAccessContext,
	): boolean {
		if (!context) {
			return false;
		}

		if (matcher.page && matcher.page !== context.page) {
			return false;
		}

		return true;
	}

	private isLimitedTimeRuleActive(
		rule: LimitedTimeFeatureRule | undefined,
	): boolean {
		if (!rule?.enabled) {
			return false;
		}

		if (!rule.expiresAt) {
			return true;
		}

		const expiresAt = new Date(rule.expiresAt);
		if (Number.isNaN(expiresAt.getTime())) {
			return false;
		}

		return Date.now() <= expiresAt.getTime();
	}

	private isLimitedTimeFeatureOpen(
		featureId: string,
		context?: PremiumFeatureAccessContext,
	): boolean {
		const rule = LIMITED_TIME_FEATURE_ACCESS[featureId];
		if (!this.isLimitedTimeRuleActive(rule) || !rule) {
			return false;
		}

		return rule.contexts.some((matcher) =>
			this.isContextMatched(context, matcher),
		);
	}
}

export interface PremiumFeatureAccessContext {
	page?: string;
}

interface LimitedTimeFeatureRule {
	enabled: boolean;
	expiresAt?: string | null;
	contexts: PremiumFeatureAccessContext[];
}

const LIMITED_TIME_FEATURE_ACCESS: Partial<
	Record<string, LimitedTimeFeatureRule>
> = isIrStandalone ? {} : {};

/**
 * 默认导出单例实例获取方法
 */
export default PremiumFeatureGuard;

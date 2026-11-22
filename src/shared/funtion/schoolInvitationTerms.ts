export function validSchoolInvitationTerms(value: unknown): boolean {
 if (!value || typeof value !== "object") return false;
 const terms = value as Record<string, unknown>;
 if (terms.billingMode !== "sponsored" && terms.billingMode !== "individual") return false;
 return terms.billingMode === "sponsored" || (typeof terms.individualPriceSatang === "number" && Number.isSafeInteger(terms.individualPriceSatang) && terms.individualPriceSatang > 0);
}

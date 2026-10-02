/** A Boost invite must name an option belonging to the displayed FanWar. */
export function getBoostOptionId(values: string[], optionIds: number[]): number | null {
    if (values.length !== 1 || !/^[1-9]\d*$/.test(values[0])) return null;
    const id = Number(values[0]);
    return Number.isSafeInteger(id) && optionIds.includes(id) ? id : null;
}

/** Ordinary shares start with a clean battle URL, even when opened from Boost. */
export function buildBattleShareUrl(
    origin: string,
    battleId: number,
    referral: string | null,
    boostOptionId?: number,
): URL {
    const url = new URL(`/battle/${battleId}`, origin);
    if (referral) url.searchParams.set("ref", referral);
    if (boostOptionId !== undefined) url.searchParams.set("boost", String(boostOptionId));
    return url;
}

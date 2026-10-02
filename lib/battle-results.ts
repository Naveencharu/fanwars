export type BattleResult = {
    option_id: number;
    option_name: string;
    vote_count: number;
};

export type BattleOption = {
    id: number;
    battle_id: number;
    name: string;
    position: number;
};

// The captured get_battle_results RPC orders rows by option position.
// Closed options can be hidden by the current SELECT policy, while the RPC
// still exposes their public names and aggregate scores.
export function getDisplayOptions(
    battleId: number,
    status: string,
    options: BattleOption[],
    results: BattleResult[],
): BattleOption[] {
    if (status !== "closed" || options.length > 0) return options;
    return results.map((result, index) => ({
        id: result.option_id,
        battle_id: battleId,
        name: result.option_name,
        position: index + 1,
    }));
}

type ResultsClient = {
    rpc: (name: "get_battle_results", args: { p_battle_id: number }) =>
        PromiseLike<{ data: BattleResult[] | null; error: unknown }>;
};

export async function loadVoteCounts(client: ResultsClient, battleIds: number[]) {
    const counts = new Map<number, number>();
    // Limit parallel requests so larger clan histories don't flood the API.
    const ids = [...new Set(battleIds)];
    for (let offset = 0; offset < ids.length; offset += 4) {
        const responses = await Promise.all(ids.slice(offset, offset + 4).map(
            (id) => client.rpc("get_battle_results", { p_battle_id: id }),
        ));
        for (const response of responses) {
            if (response.error) throw response.error;
            if (!response.data) throw new Error("FanWar results are unavailable.");
            for (const result of response.data) {
                counts.set(result.option_id, Number(result.vote_count));
            }
        }
    }
    return counts;
}

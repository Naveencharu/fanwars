/** Keep users on FanWars and return them to the battle they came from. */
export function getAuthDestination(
    redirect: string | null,
    referral: string | null,
    origin: string
): string {
    if (!redirect) return "/home";

    try {
        const destination = new URL(redirect, origin);
        if (destination.origin !== origin || destination.pathname.startsWith("//")) {
            return "/home";
        }
        if (referral && !destination.searchParams.has("ref")) {
            destination.searchParams.set("ref", referral);
        }
        return `${destination.pathname}${destination.search}${destination.hash}`;
    } catch {
        return "/home";
    }
}

export type CoverSide = { name: string; image: string | null };

/** Match the side itself. A broad category must never choose its image. */
export function sideCoverPath(name: string): string | null {
    const choices: [RegExp, string][] = [
        [/\b(chai|tea)\b/i, "chai"], [/\bcoffee\b/i, "coffee"],
        [/cricket/i, "cricket"], [/\b(football|soccer)\b/i, "football"],
        [/\bbiryani\b/i, "biryani"], [/\bpizza\b/i, "pizza"],
        [/\b(marvel|iron[ -]?man)\b/i, "marvel"], [/\b(dc|batman)\b/i, "dc"],
        [/\b(mountains?|moutains?|mountaineers?|himalayas?|alpine)\b/i, "mountain"],
        [/\b(beach(?:es)?|beachgoers?|seaside|coast|ocean)\b/i, "beach"],
        [/\b(mac|macbook|macos|macintosh)\b/i, "mac"],
        [/\b(windows?|microsoft|pc)\b/i, "windows"],
        [/\b(android|samsung)\b/i, "android"], [/\b(iphone|apple)\b/i, "iphone"],
        [/\b(rcb|csk|ipl|dhoni|kohli|rohit|batsmen|bowler)\b/i, "cricket"],
        [/\b(messi|ronaldo|fifa|arsenal|liverpool)\b/i, "football"],
        [/\b(basketball|nba|lakers)\b/i, "basketball"],
        [/\b(tennis|wimbledon|federer|nadal)\b/i, "tennis"],
        [/\b(anime|manga|naruto|otaku)\b/i, "anime"],
        [/\b(music|musical|song|songs|singers?|headphones?|beats|rap|rock|swift|bts)\b/i, "music"],
        [/\b(movies?|cinema|films?|hollywood|bollywood|tollywood|entertainment)\b/i, "movies"],
        [/\b(gaming|gamers?|games?|playstation|xbox|esports|ps5|pubg)\b/i, "gaming"],
        [/\b(travel|trek|trekking|hiking|adventure)\b/i, "mountain"],
        [/\b(food|foodies|cooking|cuisine|chef)\b/i, "biryani"],
    ];
    const match = choices.find(([pattern]) => pattern.test(name));
    return match ? `/battle-covers/${match[1]}.jpg` : null;
}

/** Custom clans inherit their parent topic; unspecified fan groups get a crowd backdrop. */
export function communityCoverPath(name: string, description = "", parentTopic = ""): string {
    const namedTechnology = /\bgates\b/i.test(name) ? "/battle-covers/windows.jpg"
        : /\b(jobs|tech|technology|coding|developer)\b/i.test(name) ? "/battle-covers/mac.jpg" : null;
    return sideCoverPath(name) ?? namedTechnology ?? sideCoverPath(description)
        ?? sideCoverPath(parentTopic) ?? "/battle-covers/community.jpg";
}

export function battleCoverSides(title: string, optionNames: string[] = []): CoverSide[] {
    const parts = title.split(/\s+v(?:s\.?|ersus)?\s+/i).map(part => part.trim());
    const names = optionNames.length >= 2 ? optionNames.slice(0, 2) : parts.slice(0, 2);
    return names.map((name, index) => ({ name,
        image: sideCoverPath(name) ?? sideCoverPath(parts[index] ?? ""),
    }));
}

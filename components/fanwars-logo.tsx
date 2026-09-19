import Link from "next/link";

type FanWarsLogoProps = {
    href?: string;
    showName?: boolean;
    size?: "sm" | "md" | "lg";
};

function FanWarsMark({ className = "" }: { className?: string }) {
    return (
        <svg
            viewBox="0 0 48 48"
            className={className}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
        >
            {/* Left sword blade */}
            <path
                d="M10 8L24 22L20.5 25.5L6.5 11.5L10 8Z"
                fill="currentColor"
            />

            {/* Left sword tip */}
            <path
                d="M10 8L5.5 5L6.5 11.5L10 8Z"
                fill="currentColor"
            />

            {/* Left crossguard */}
            <path
                d="M15 25L22 32"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
            />

            {/* Left handle */}
            <path
                d="M20.5 30.5L13 38"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
            />

            {/* Left pommel */}
            <circle
                cx="11"
                cy="40"
                r="3"
                fill="currentColor"
            />

            {/* Right sword blade */}
            <path
                d="M38 8L24 22L27.5 25.5L41.5 11.5L38 8Z"
                fill="currentColor"
            />

            {/* Right sword tip */}
            <path
                d="M38 8L42.5 5L41.5 11.5L38 8Z"
                fill="currentColor"
            />

            {/* Right crossguard */}
            <path
                d="M33 25L26 32"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
            />

            {/* Right handle */}
            <path
                d="M27.5 30.5L35 38"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
            />

            {/* Right pommel */}
            <circle
                cx="37"
                cy="40"
                r="3"
                fill="currentColor"
            />
        </svg>
    );
}

export default function FanWarsLogo({
    href = "/",
    showName = true,
    size = "md",
}: FanWarsLogoProps) {
    const sizes = {
        sm: {
            circle: "h-8 w-8",
            icon: "h-[19px] w-[19px]",
            text: "text-[17px]",
        },
        md: {
            circle: "h-9 w-9",
            icon: "h-[22px] w-[22px]",
            text: "text-[19px]",
        },
        lg: {
            circle: "h-12 w-12",
            icon: "h-[28px] w-[28px]",
            text: "text-[23px]",
        },
    };

    const s = sizes[size];

    return (
        <Link
            href={href}
            className="inline-flex items-center gap-2.5"
            aria-label="FanWars"
        >
            <span
                className={`${s.circle} flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#a855f7] via-[#c044df] to-[#ec4899]`}
            >
                <FanWarsMark className={`${s.icon} text-white`} />
            </span>

            {showName && (
                <span
                    className={`${s.text} font-black leading-none tracking-[-0.055em] text-[#171525]`}
                >
                    FanWars
                </span>
            )}
        </Link>
    );
}

export { FanWarsMark };
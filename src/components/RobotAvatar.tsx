import { useId } from "react";
import { AGENT_COLORS, type AgentColor } from "../../shared/agent-avatar";

/** Channel-wise mix of a hex color toward another, t in 0..1. */
function mix(hex: string, toward: string, t: number): string {
  const a = Number.parseInt(hex.slice(1), 16);
  const b = Number.parseInt(toward.slice(1), 16);
  const channel = (shift: number) => {
    const va = (a >> shift) & 0xff;
    const vb = (b >> shift) & 0xff;
    return Math.round(va + (vb - va) * t);
  };
  return `#${[channel(16), channel(8), channel(0)]
    .map((part) => part.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function RobotAvatar({
  color,
  size = 44,
  label = "Robot avatar",
  className,
}: {
  color: AgentColor;
  size?: number;
  label?: string;
  className?: string;
}) {
  const gradientId = `robot-${useId()}`;
  const fill = AGENT_COLORS[color];
  const shadow = mix(fill, "#000000", 0.42);
  const paint = `url(#${gradientId})`;

  return (
    <svg
      viewBox="-15 -15 258.541 258.541"
      width={size}
      height={size}
      role="img"
      aria-label={label}
      className={`block shrink-0 select-none ${className ?? ""}`}
    >
      <defs>
        <linearGradient id={gradientId} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={mix(fill, "#ffffff", 0.55)} />
          <stop offset="55%" stopColor={fill} />
          <stop offset="100%" stopColor={shadow} />
        </linearGradient>
      </defs>
      <rect x="108" y="28" width="12" height="36" rx="6" fill={shadow} />
      <circle cx="114" cy="24" r="14" fill={paint} />
      <circle cx="110" cy="20" r="4" fill="#ffffff" fillOpacity=".8" />
      <rect x="14" y="100" width="28" height="48" rx="14" fill={shadow} />
      <rect x="186" y="100" width="28" height="48" rx="14" fill={shadow} />
      <rect x="88" y="183" width="52" height="25" rx="12" fill={shadow} />
      <rect x="30" y="52" width="168" height="142" rx="48" fill={paint} />
      <path d="M48 83Q57 63 82 63H144" fill="none" stroke="#ffffff" strokeOpacity=".4" strokeWidth="6" strokeLinecap="round" />
      <rect x="46" y="76" width="136" height="98" rx="32" fill="#142539" />
      <path d="M59 99Q63 86 80 86H147" fill="none" stroke="#ffffff" strokeOpacity=".12" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="65" cy="145" rx="9" ry="5" fill="#ff9cab" fillOpacity=".8" />
      <ellipse cx="163" cy="145" rx="9" ry="5" fill="#ff9cab" fillOpacity=".8" />
      <rect x="86" y="107" width="14" height="23" rx="7" fill="#ffffff" />
      <rect x="128" y="107" width="14" height="23" rx="7" fill="#ffffff" />
      <path d="M103 143Q114 153 125 143" fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
      <circle cx="106" cy="199" r="3" fill="#ffffff" fillOpacity=".9" />
      <circle cx="122" cy="199" r="3" fill="#ffffff" fillOpacity=".45" />
    </svg>
  );
}

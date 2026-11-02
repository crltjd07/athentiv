import { Crown } from "lucide-react";
import { avatarOf } from "@/shared/catalog";
import { cx } from "@/lib/cx";

export function Avatar({ avatarKey, size = 44, className, ring }: { avatarKey: string; size?: number; className?: string; ring?: boolean }) {
  const a = avatarOf(avatarKey);
  return (
    <span
      className={cx("relative inline-grid shrink-0 place-items-center rounded-full", ring && "ring-2 ring-white shadow-md", className)}
      style={{ width: size, height: size, background: a.bg, fontSize: size * 0.56 }}
      role="img"
      aria-label={`${a.name} avatar`}
    >
      <span className="leading-none">{a.emoji}</span>
      {a.tier === "premium" && size >= 40 && (
        <span className="absolute -right-0.5 -bottom-0.5 grid size-[38%] min-h-4 min-w-4 place-items-center rounded-full border-2 border-white bg-amber-400 text-white">
          <Crown className="size-[60%]" strokeWidth={2.5} />
        </span>
      )}
    </span>
  );
}

import {
  Atom, Book, Calculator, Code, Cpu, Database, Dumbbell, FlaskConical, GraduationCap, Globe, Landmark, Languages, Leaf, Music, Network, Palette, PenLine, Sigma, Users,
  type LucideIcon,
} from "lucide-react";
import { cx } from "@/lib/cx";

export const SUBJECT_ICON_MAP: Record<string, LucideIcon> = {
  sigma: Sigma, code: Code, atom: Atom, flask: FlaskConical, book: Book, languages: Languages, landmark: Landmark,
  dumbbell: Dumbbell, users: Users, cpu: Cpu, database: Database, network: Network, leaf: Leaf, palette: Palette,
  music: Music, globe: Globe, calculator: Calculator, pen: PenLine,
};

export function SubjectIcon({ icon, color, size = 40, className }: { icon?: string | null; color?: string | null; size?: number; className?: string }) {
  const Icon = (icon && SUBJECT_ICON_MAP[icon]) || GraduationCap;
  const c = color ?? "#64748B";
  return (
    <span className={cx("grid shrink-0 place-items-center rounded-xl text-white", className)} style={{ width: size, height: size, background: c }}>
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={2.2} />
    </span>
  );
}

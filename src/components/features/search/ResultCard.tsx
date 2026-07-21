import Link from "next/link";
import { Card } from "@/components/ui/Card";

export function ResultCard({
  href,
  icon,
  label,
  title,
  detail,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  title: string;
  detail: string;
}) {
  return (
    <Link href={href}>
      <Card className="flex h-full items-center gap-4 transition hover:-translate-y-0.5 hover:shadow-soft">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-kondo-mint text-kondo-green dark:bg-emerald-400/10 [&>svg]:h-5 [&>svg]:w-5">
          {icon}
        </span>
        <span>
          <span className="text-[10px] font-black uppercase tracking-wider text-kondo-green">
            {label}
          </span>
          <span className="mt-1 block font-bold text-kondo-ink dark:text-white">
            {title}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            {detail}
          </span>
        </span>
      </Card>
    </Link>
  );
}

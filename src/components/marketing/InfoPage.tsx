import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { KondoLogo } from "@/components/KondoLogo";
import { Button } from "@/components/ui/Button";

export function InfoPage({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-background px-5 py-6 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-center justify-between">
          <KondoLogo />
          <Button asChild size="sm" variant="ghost">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" /> Home
            </Link>
          </Button>
        </div>
        <article className="mt-12 rounded-4xl border border-border bg-card p-7 text-card-foreground shadow-soft sm:p-12">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-kondo-green">
            {eyebrow}
          </p>
          <h1 className="mt-4 text-balance text-4xl font-black tracking-[-0.05em] text-kondo-ink dark:text-white sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            {description}
          </p>
          <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground [&_h2]:text-xl [&_h2]:font-black [&_h2]:tracking-tight [&_h2]:text-kondo-ink dark:[&_h2]:text-white [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
            {children}
          </div>
        </article>
      </div>
    </main>
  );
}

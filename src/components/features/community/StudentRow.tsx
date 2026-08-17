import Link from "next/link";
import { ChevronRight, MessageCircle } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";

/**
 * One student, in a list.
 *
 * Shared by Community → Nearby and Community → Meet → Looking For so both read
 * as the same product. The two differ only in what they put on the context
 * line: Nearby answers "how far away, and why them", Looking For answers "how
 * far away, and what they matched". The row itself does not care which.
 *
 * Deliberately flat — no card, no border, no shadow, no nesting. A separator
 * and honest spacing carry the structure, which is what makes a long list
 * scannable on a phone.
 */

export type StudentRowData = {
  id: string;
  username: string | null;
  firstName: string;
  lastName: string;
  avatarMediaId: string | null;
  /** "Computer Science · Jiaxing University" */
  headline: string | null;
  /** The line under the headline, already assembled and free of repetition. */
  context: string | null;
};

export function StudentRow({
  student,
  canMessage = true,
}: {
  student: StudentRowData;
  /**
   * Messaging is only offered where it would actually work. A disabled-looking
   * action that silently fails is worse than no action.
   */
  canMessage?: boolean;
}) {
  const name = `${student.firstName} ${student.lastName}`.trim();

  return (
    <li className="border-b border-border/60 last:border-b-0">
      <div className="group flex items-center gap-3 py-2.5 pl-1 pr-1">
        <Link
          className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl py-1.5 transition active:scale-[0.99] motion-reduce:transform-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          href={`/profile/${student.username ?? student.id}`}
        >
          <Avatar
            className="h-10 w-10"
            firstName={student.firstName}
            lastName={student.lastName}
            mediaId={student.avatarMediaId}
            seed={student.id}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-black tracking-[-0.01em] text-foreground">
              {name}
            </span>
            {student.headline ? (
              <span className="mt-0.5 block truncate text-xs font-bold text-muted-foreground">
                {student.headline}
              </span>
            ) : null}
            {student.context ? (
              /*
               * The one line allowed to wrap. "2 km away · 4 communities in
               * common" does not fit a 390px row, and truncating it cut off
               * the number, which is the part worth reading.
               */
              <span className="mt-0.5 block text-xs font-bold leading-4 text-kondo-green">
                {student.context}
              </span>
            ) : null}
          </span>
          <ChevronRight
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-muted-foreground/70 transition group-hover:text-foreground sm:hidden"
          />
        </Link>
        {canMessage ? (
          <Button
            aria-label={`Message ${name}`}
            asChild
            className="hidden shrink-0 sm:inline-flex"
            size="sm"
            variant="secondary"
          >
            <Link href={`/messages/new?recipient=${student.id}`}>
              <MessageCircle aria-hidden="true" className="h-4 w-4" />
              Message
            </Link>
          </Button>
        ) : null}
      </div>
    </li>
  );
}

/** Matched to the real row's geometry so nothing shifts when data lands. */
export function StudentRowSkeleton() {
  return (
    <li className="flex items-center gap-3 px-1 py-3">
      <span className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
      <span className="min-w-0 flex-1">
        <span className="block h-3.5 w-28 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
        <span className="mt-2 block h-3 w-44 max-w-full animate-pulse rounded-full bg-muted/70 motion-reduce:animate-none" />
        <span className="mt-1.5 block h-3 w-24 animate-pulse rounded-full bg-muted/50 motion-reduce:animate-none" />
      </span>
    </li>
  );
}

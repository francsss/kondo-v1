import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export function MessageUserButton({
  userId,
  currentUserId,
  label = "Message",
  compact = false,
  className,
}: {
  userId: string;
  currentUserId: string;
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  if (userId === currentUserId) return null;

  return (
    <Button
      asChild
      className={cn(compact && "h-8 px-3 text-xs", className)}
      size={compact ? "sm" : "md"}
      variant="secondary"
    >
      <Link
        href={`/messages/new?${new URLSearchParams({
          recipient: userId,
        }).toString()}`}
      >
        <MessageCircle aria-hidden="true" className="h-4 w-4" />
        {label}
      </Link>
    </Button>
  );
}

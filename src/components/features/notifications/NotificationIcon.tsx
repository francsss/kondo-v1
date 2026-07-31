import {
  BadgeCheck,
  BellRing,
  BookOpenCheck,
  CalendarDays,
  CircleDollarSign,
  GraduationCap,
  Heart,
  House,
  Laptop,
  ListTodo,
  MessageCircle,
  MessagesSquare,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  University,
  UserRoundPlus,
  UsersRound,
} from "lucide-react";
import type {
  KondoNotificationCategory,
  NotificationIconName,
} from "@/features/notifications/presentation";
import { cn } from "@/lib/utils";

const icons = {
  message: MessageCircle,
  friend: UserRoundPlus,
  community: UsersRound,
  event: CalendarDays,
  marketplace: ShoppingBag,
  housing: House,
  comment: MessagesSquare,
  reaction: Heart,
  schedule: BookOpenCheck,
  assignment: ListTodo,
  exam: GraduationCap,
  university: University,
  payment: ReceiptText,
  transfer: CircleDollarSign,
  security: ShieldCheck,
  device: Laptop,
  system: BellRing,
} satisfies Record<NotificationIconName, typeof BadgeCheck>;

const categoryStyles: Record<KondoNotificationCategory, string> = {
  messages:
    "bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-400/10 dark:text-sky-300 dark:ring-sky-400/20",
  friends:
    "bg-violet-100 text-violet-700 ring-violet-200 dark:bg-violet-400/10 dark:text-violet-300 dark:ring-violet-400/20",
  communities:
    "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20",
  events:
    "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-400/10 dark:text-amber-300 dark:ring-amber-400/20",
  marketplace:
    "bg-orange-100 text-orange-700 ring-orange-200 dark:bg-orange-400/10 dark:text-orange-300 dark:ring-orange-400/20",
  housing:
    "bg-teal-100 text-teal-700 ring-teal-200 dark:bg-teal-400/10 dark:text-teal-300 dark:ring-teal-400/20",
  opportunities:
    "bg-indigo-100 text-indigo-700 ring-indigo-200 dark:bg-indigo-400/10 dark:text-indigo-300 dark:ring-indigo-400/20",
  schedule:
    "bg-indigo-100 text-indigo-700 ring-indigo-200 dark:bg-indigo-400/10 dark:text-indigo-300 dark:ring-indigo-400/20",
  transfers:
    "bg-teal-100 text-teal-700 ring-teal-200 dark:bg-teal-400/10 dark:text-teal-300 dark:ring-teal-400/20",
  university:
    "bg-blue-100 text-blue-700 ring-blue-200 dark:bg-blue-400/10 dark:text-blue-300 dark:ring-blue-400/20",
  security:
    "bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-400/10 dark:text-rose-300 dark:ring-rose-400/20",
  system:
    "bg-kondo-mint text-kondo-forest ring-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-300 dark:ring-emerald-400/20",
};

export function NotificationIcon({
  category,
  icon,
  className,
}: {
  category: KondoNotificationCategory;
  icon: NotificationIconName;
  className?: string;
}) {
  const Icon = icons[icon];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid h-11 w-11 shrink-0 place-items-center rounded-2xl ring-1",
        categoryStyles[category],
        className,
      )}
    >
      <Icon className="h-[19px] w-[19px]" strokeWidth={2.2} />
    </span>
  );
}

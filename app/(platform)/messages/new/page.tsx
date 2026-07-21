import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { MessageComposer } from "@/components/features/messages/MessageComposer";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { directConversationKey } from "@/lib/messaging";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

export const metadata: Metadata = { title: "New message" };

export default async function NewMessagePage({
  searchParams,
}: {
  searchParams: Promise<{
    recipient?: string;
    sourceType?: string;
    sourceId?: string;
  }>;
}) {
  const user = await requireUser();
  const { recipient: recipientId, sourceType, sourceId } = await searchParams;
  if (!recipientId || recipientId === user.id) redirect("/messages");

  const [recipient, existing] = await Promise.all([
    prisma.user.findFirst({
      where: { id: recipientId, status: "ACTIVE" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
        university: { select: { name: true, shortName: true } },
      },
    }),
    prisma.conversation.findUnique({
      where: { directKey: directConversationKey(user.id, recipientId) },
      select: { id: true },
    }),
  ]);
  if (!recipient) notFound();
  if (existing) redirect(`/messages/${existing.id}`);

  return (
    <div className="mx-auto max-w-[760px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16">
      <Button asChild size="sm" variant="ghost">
        <Link href="/messages">
          <ChevronLeft className="h-4 w-4" /> Messages
        </Link>
      </Button>
      <Card className="mt-4 overflow-hidden p-0">
        <div className="border-b border-slate-100 p-5 dark:border-white/10 sm:p-6">
          <div className="flex items-center gap-3">
            <Avatar
              className="h-12 w-12"
              firstName={recipient.firstName}
              lastName={recipient.lastName}
            />
            <div className="min-w-0">
              <h1 className="truncate text-lg font-black text-kondo-ink dark:text-white">
                {recipient.firstName} {recipient.lastName}
              </h1>
              <p className="truncate text-xs text-muted-foreground">
                {recipient.university?.shortName ??
                  recipient.university?.name ??
                  "Kondo member"}
              </p>
            </div>
          </div>
        </div>
        <div className="grid min-h-[360px] place-items-center bg-slate-50/70 px-6 py-12 text-center dark:bg-white/[0.02]">
          <div className="max-w-sm">
            <ShieldCheck className="mx-auto h-8 w-8 text-kondo-green" />
            <h2 className="mt-4 text-xl font-black text-kondo-ink dark:text-white">
              Start a private conversation
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              The conversation is created only when you send the first message.
              Be respectful and never share payment passwords or verification
              codes.
            </p>
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <MessageComposer
            recipientId={recipient.id}
            sourceId={
              sourceType === "MARKETPLACE_LISTING" ? sourceId : undefined
            }
            sourceType={
              sourceType === "MARKETPLACE_LISTING"
                ? "MARKETPLACE_LISTING"
                : undefined
            }
          />
        </div>
      </Card>
    </div>
  );
}

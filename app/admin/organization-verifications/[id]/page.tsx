import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText, LockKeyhole } from "lucide-react";
import { AdminNav } from "@/components/features/admin/AdminNav";
import { OrganizationVerificationReview } from "@/components/features/admin/OrganizationVerificationReview";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { hasAdminPermission } from "@/lib/authorization";
import { OrganizationError } from "@/lib/organizations";
import { getAdminOrganizationVerification } from "@/lib/organization-verification";
import { requireAdminPermission } from "@/lib/server-auth";

export const metadata: Metadata = {
  title: "Admin organization verification review",
};

export default async function AdminOrganizationVerificationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireAdminPermission("ORGANIZATION_VERIFICATIONS_VIEW");
  let request;
  try {
    request = await getAdminOrganizationVerification(actor, (await params).id);
  } catch (error) {
    if (error instanceof OrganizationError && error.status === 404) notFound();
    throw error;
  }

  return (
    <main className="mx-auto max-w-[1180px] px-4 pb-28 pt-7 sm:px-6 lg:px-8 lg:pb-16 lg:pt-10">
      <Button asChild size="sm" variant="ghost">
        <Link href="/admin/organization-verifications">
          <ArrowLeft className="h-4 w-4" /> Verification queue
        </Link>
      </Button>
      <div className="mt-4">
        <PageHeader
          description={`${request.organization.type.replaceAll("_", " ")} · request version ${request.version}`}
          eyebrow="Confidential organization evidence"
          title={request.organization.publicName}
        />
      </div>
      <AdminNav
        currentPath={`/admin/organization-verifications/${request.id}`}
        role={actor.role}
      />
      <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-6">
          <Card>
            <div className="flex items-center gap-3">
              <LockKeyhole className="h-5 w-5 text-kondo-green" />
              <h2 className="font-black">Submitted authority</h2>
            </div>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <Fact label="Request status" value={request.status} />
              <Fact
                label="Organization summary status"
                value={request.organization.verificationStatus}
              />
              <Fact label="Legal name" value={request.legalNameSnapshot} />
              <Fact
                label="Registration number"
                value={request.registrationNumber ?? "Not provided"}
              />
              <Fact
                label="Registration country"
                value={`${request.registrationCountry.name} (${request.registrationCountry.code})`}
              />
              <Fact label="Public contact" value={request.publicContactEmail} />
              <Fact
                label="Official website"
                value={request.officialWebsite ?? "Not provided"}
              />
              <Fact
                label="Submitted by"
                value={`${request.submittedBy.firstName} ${request.submittedBy.lastName} · ${request.submittedBy.email}`}
              />
            </dl>
            <div className="mt-5 rounded-2xl bg-muted/60 p-4">
              <p className="text-xs font-bold text-muted-foreground">
                Authority explanation
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                {request.authorityDescription}
              </p>
            </div>
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-kondo-green" />
              <h2 className="font-black">
                Private evidence · {request.documents.length}
              </h2>
            </div>
            <div className="mt-4 grid gap-3">
              {request.documents.map((document) => (
                <div
                  className="flex flex-col gap-3 rounded-2xl border border-border p-4 sm:flex-row sm:items-center"
                  key={document.id}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-black">{document.label}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {document.type.replaceAll("_", " ")} ·{" "}
                      {document.media.originalFileName} ·{" "}
                      {(document.media.sizeBytes / 1024).toFixed(1)} KB ·{" "}
                      {document.media.scanStatus}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="secondary">
                    <a
                      href={`/api/media/${document.mediaId}`}
                      rel="noreferrer"
                      target="_blank"
                    >
                      Secure preview <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          {request.reviewerNote || request.userVisibleResponse ? (
            <Card>
              <h2 className="font-black">Previous review record</h2>
              {request.userVisibleResponse ? (
                <Fact
                  label="Organization-visible response"
                  value={request.userVisibleResponse}
                />
              ) : null}
              {request.reviewerNote ? (
                <div className="mt-4">
                  <Fact
                    label="Internal reviewer note"
                    value={request.reviewerNote}
                  />
                </div>
              ) : null}
            </Card>
          ) : null}
        </div>

        <Card className="h-fit">
          <h2 className="font-black">Reviewed decision</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Internal notes remain private. The organization-visible response is
            sent to active owners and administrators.
          </p>
          <div className="mt-5">
            {hasAdminPermission(
              actor.role,
              "ORGANIZATION_VERIFICATIONS_REVIEW",
            ) ? (
              <OrganizationVerificationReview
                currentStatus={request.status}
                requestId={request.id}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Your role can inspect evidence but cannot make a decision.
              </p>
            )}
          </div>
        </Card>
      </div>
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border pb-3">
      <dt className="text-xs font-bold text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold">{value}</dd>
    </div>
  );
}

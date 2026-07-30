"use client";

import { useEffect, useRef } from "react";
import { captureProductEvent } from "@/lib/product-analytics-client";
import { PRODUCT_EVENTS } from "@/lib/product-analytics-events";

export function OrganizationPublicAnalytics({
  organizationType,
  verificationState,
  partner,
  preview = false,
}: {
  organizationType: string;
  verificationState: string;
  partner: boolean;
  preview?: boolean;
}) {
  const captured = useRef(false);

  useEffect(() => {
    if (captured.current) return;
    captured.current = true;
    captureProductEvent(
      preview
        ? PRODUCT_EVENTS.ORGANIZATION_PUBLIC_PROFILE_PREVIEWED
        : PRODUCT_EVENTS.ORGANIZATION_PUBLIC_PROFILE_VIEWED,
      {
        organization_type: organizationType,
        verification_state: verificationState,
        partner,
      },
    );
  }, [organizationType, partner, preview, verificationState]);

  return null;
}

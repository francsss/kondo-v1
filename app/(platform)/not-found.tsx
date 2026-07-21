import Link from "next/link";
import { MapPinOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function PlatformNotFound() {
  return (
    <div className="mx-auto max-w-[720px] px-4 pb-28 pt-12 sm:px-6 lg:px-8">
      <Card className="text-center">
        <MapPinOff className="mx-auto h-8 w-8 text-kondo-green" />
        <h1 className="mt-4 text-xl font-black text-kondo-ink dark:text-white">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This page may have moved, expired, or be unavailable to your account.
        </p>
        <Button asChild className="mt-5">
          <Link href="/home">Return home</Link>
        </Button>
      </Card>
    </div>
  );
}

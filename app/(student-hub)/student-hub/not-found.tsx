import Link from "next/link";
import { MapPinOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/**
 * A missing page inside the Student Hub, with a way out of it.
 *
 * Without this file, Next falls through to the root not-found, which renders
 * outside `StudentHubShell` — so a member who reached a dead hub URL lost the
 * hub's own navigation *and* the back button that leaves the space, with no
 * control on screen to escape either. `(platform)` and `organizations` both
 * had one already; the hub was the space that did not.
 *
 * Two ways out on purpose: back into the hub for someone who mistyped, and out
 * to Home for someone who is finished with it.
 */
export default function StudentHubNotFound() {
  return (
    <div className="mx-auto max-w-[720px] px-4 pb-28 pt-12 sm:px-6 lg:px-8">
      <Card className="text-center">
        <MapPinOff className="mx-auto h-8 w-8 text-kondo-green" />
        <h1 className="mt-4 text-xl font-black text-kondo-ink dark:text-white">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This part of the Student Hub may have moved, or it may not be
          available to your account yet.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/student-hub">Back to Student Hub</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/home">Leave Student Hub</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}

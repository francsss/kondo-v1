import { NextRequest } from "next/server";
import { housingApiFailure } from "@/lib/housing-api";
import { saveHousingListing, unsaveHousingListing } from "@/lib/housing-saved";
import { hasTrustedOrigin, jsonError } from "@/lib/request";
import { getCurrentUser } from "@/lib/server-auth";

type Context = { params: Promise<{ id: string }> };

async function actor(request: NextRequest) {
  if (!hasTrustedOrigin(request))
    throw Object.assign(new Error("Invalid request origin."), { status: 403 });
  const user = await getCurrentUser();
  if (!user)
    throw Object.assign(new Error("Authentication required."), { status: 401 });
  return user;
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const user = await actor(request);
    return Response.json(await saveHousingListing(user.id, (await params).id), {
      status: 201,
    });
  } catch (error) {
    if (error instanceof Error && "status" in error) {
      return jsonError(error.message, Number(error.status));
    }
    return housingApiFailure("housing.saved.create", error);
  }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  try {
    const user = await actor(request);
    return Response.json(
      await unsaveHousingListing(user.id, (await params).id),
    );
  } catch (error) {
    if (error instanceof Error && "status" in error) {
      return jsonError(error.message, Number(error.status));
    }
    return housingApiFailure("housing.saved.delete", error);
  }
}

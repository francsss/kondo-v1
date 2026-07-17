import {
  adminInternalError,
  adminJson,
  authorizeAdminApi,
} from "@/lib/admin-auth";
import {
  getAdminUser,
  ProfileError,
} from "@/lib/profiles";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authorizeAdminApi("USER_VIEW");
  if (!auth.authorized) return auth.error;
  try {
    return adminJson({
      user: await getAdminUser(auth.user, (await params).id),
    });
  } catch (error) {
    if (error instanceof ProfileError) {
      return adminJson({ error: error.message }, { status: error.status });
    }
    return adminInternalError("admin.users.detail", error);
  }
}

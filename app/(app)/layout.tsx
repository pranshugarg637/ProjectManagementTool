import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { getCurrentUser } from "@/lib/supabase/server";

/** Layout for every signed-in page: checks the session and shows the top bar. */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const name = (user.user_metadata?.full_name as string | undefined) ?? null;
  return (
    <>
      <SiteHeader email={user.email ?? ""} name={name} />
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </>
  );
}

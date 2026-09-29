import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function RootPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (session.user.role === "admin") redirect("/admin/dashboard");
  if (session.user.role === "auctioneer") redirect("/auctioneer/auction");
  redirect("/team/dashboard");
}

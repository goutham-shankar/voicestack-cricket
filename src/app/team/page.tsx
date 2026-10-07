import { redirect } from "next/navigation";

/** A team signing in lands on the auction, which is what they are here for. */
export default function TeamIndexPage() {
  redirect("/team/auction");
}

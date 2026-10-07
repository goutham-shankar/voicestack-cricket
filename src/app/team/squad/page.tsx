import { redirect } from "next/navigation";

/** The squad now lives on the one team page; keep old links working. */
export default function TeamSquadPage() {
  redirect("/team/dashboard");
}

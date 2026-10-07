import { redirect } from "next/navigation";

/** The purse and ledger now live on the one team page; keep old links working. */
export default function TeamWalletPage() {
  redirect("/team/dashboard");
}

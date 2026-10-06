import { config } from "dotenv";
config({ path: ".env.local" });
import { PlayerCategories } from "@/models/PlayerCategory";
async function main() {
  try {
    const c = await PlayerCategories.find();
    console.log(`read OK — ${c.length} categories, quota is available`);
  } catch (e) {
    console.log("read FAILED:", (e as Error).message);
  }
  process.exit(0);
}
main();

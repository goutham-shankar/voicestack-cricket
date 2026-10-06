import { getSingleton } from "@/lib/firestore";
import { getCategories, getTags } from "@/lib/services/catalog";
import { AuctionSettingsStore } from "@/models/AuctionSettings";
import { CategoriesPanel } from "@/components/admin/settings/categories-panel";
import { TagsPanel } from "@/components/admin/settings/tags-panel";
import { DefaultsForm } from "@/components/admin/settings/defaults-form";

function serialize<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

export default async function AdminSettingsPage() {
  const [categories, tags, settingsDoc] = await Promise.all([
    getCategories(),
    getTags(),
    getSingleton(AuctionSettingsStore),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Configuration</h1>
        <p className="text-sm text-muted-foreground">
          Player categories, base prices, tags and auction-wide defaults.
        </p>
      </div>

      <DefaultsForm initialSettings={serialize(settingsDoc)} />
      <CategoriesPanel initialCategories={serialize(categories)} />
      <TagsPanel initialTags={serialize(tags)} />
    </div>
  );
}

import { Gallery } from "@/components/gallery";
import { readCombinedGallery } from "@/lib/live-gallery";
import type { DiscoverResponse } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  return <Gallery initialData={await getInitialGallery()} />;
}

async function getInitialGallery(): Promise<DiscoverResponse> {
  return readCombinedGallery();
}

export type GalleryItem = {
  id: string;
  title?: string;
  style?: string;
  styleLabel?: string;
  author: string;
  handle: string;
  prompt: string;
  imageUrl: string;
  images?: string[];
  directImageUrls?: string[];
  sourceUrl: string;
  createdAt?: string;
  engine: "gpt-image-2" | "unknown";
};

export type DiscoverResponse = {
  source: "local" | "x-web" | "x-api" | "nitter" | "unavailable" | "idle";
  query: string;
  items: GalleryItem[];
  message?: string;
  diagnostics?: {
    hasBearerToken: boolean;
    xWebReachable?: boolean;
    attempted: string[];
  };
};

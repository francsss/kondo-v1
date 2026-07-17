export type ExploreIconName =
  | "companies"
  | "products"
  | "universities"
  | "jobs"
  | "events"
  | "services"
  | "about";

export type ExploreAccent =
  | "emerald"
  | "amber"
  | "blue"
  | "violet"
  | "rose"
  | "cyan"
  | "slate";

export type ExploreEntryType =
  | "company"
  | "product"
  | "university"
  | "opportunity"
  | "event"
  | "service"
  | "story";

export type ExploreSource = {
  label: string;
  href: string;
};

export type ExploreEntry = {
  id: string;
  slug: string;
  type: ExploreEntryType;
  title: string;
  category: string;
  summary: string;
  location?: string;
  status?: string;
  tags: readonly string[];
  details: readonly string[];
  source?: ExploreSource;
};

export type ExploreSection = {
  slug: string;
  title: string;
  shortTitle: string;
  eyebrow: string;
  summary: string;
  description: string;
  icon: ExploreIconName;
  accent: ExploreAccent;
  signal: string;
  studentValue: string;
  cityValue: string;
  entries: readonly ExploreEntry[];
};

export type ExploreCity = {
  slug: string;
  name: string;
  province: string;
  country: string;
  eyebrow: string;
  title: string;
  tagline: string;
  summary: string;
  description: string;
  signals: readonly {
    label: string;
    value: string;
  }[];
  impactPoints: readonly {
    title: string;
    description: string;
  }[];
  sections: readonly ExploreSection[];
};

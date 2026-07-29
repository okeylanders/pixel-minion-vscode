export interface ModelBrowserBadge {
  label: string;
  tone?: 'default' | 'accent';
}

export interface ModelBrowserOption {
  id: string;
  label: string;
  description?: string;
  narrative?: string;
  provider: string;
  family: string;
  releaseDate?: string;
  costLabel?: string;
  estimateLabel?: string;
  badges: ModelBrowserBadge[];
  searchText?: string;
}

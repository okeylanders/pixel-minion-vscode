export interface ModelBrowserBadge {
  label: string;
  tone?: 'default' | 'accent';
}

export interface ModelBrowserOption {
  id: string;
  label: string;
  description: string;
  provider: string;
  family: string;
  costLabel?: string;
  estimateLabel?: string;
  badges: ModelBrowserBadge[];
}

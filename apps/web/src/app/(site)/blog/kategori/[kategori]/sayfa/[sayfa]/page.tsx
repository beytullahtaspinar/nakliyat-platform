import { CategoryIndex, categoryMetadata, parsePage } from "@/components/blog/blog-routes";
import { categoryPath } from "@/lib/blog/wordpress";

export const revalidate = 3600;

export const dynamicParams = true;
export function generateStaticParams(): { kategori: string; sayfa: string }[] {
  return [];
}

type Props = { params: Promise<{ kategori: string; sayfa: string }> };

export async function generateMetadata({ params }: Props) {
  const { kategori, sayfa } = await params;
  return categoryMetadata(kategori, parsePage(sayfa, categoryPath({ slug: kategori })));
}

export default async function BlogCategoryPaginatedPage({ params }: Props) {
  const { kategori, sayfa } = await params;
  return <CategoryIndex slug={kategori} page={parsePage(sayfa, categoryPath({ slug: kategori }))} />;
}

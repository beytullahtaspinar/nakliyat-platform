import { CategoryIndex, categoryMetadata } from "@/components/blog/blog-routes";

export const revalidate = 3600;

export const dynamicParams = true;
export function generateStaticParams(): { kategori: string }[] {
  return [];
}

type Props = { params: Promise<{ kategori: string }> };

export async function generateMetadata({ params }: Props) {
  return categoryMetadata((await params).kategori, 1);
}

export default async function BlogCategoryPage({ params }: Props) {
  return <CategoryIndex slug={(await params).kategori} page={1} />;
}

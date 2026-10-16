import { AuthorIndex, authorMetadata, parsePage } from "@/components/blog/blog-routes";
import { authorPath } from "@/lib/blog/api";

export const revalidate = 900;

export const dynamicParams = true;
export function generateStaticParams(): { yazar: string; sayfa: string }[] {
  return [];
}

type Props = { params: Promise<{ yazar: string; sayfa: string }> };

export async function generateMetadata({ params }: Props) {
  const { yazar, sayfa } = await params;
  return authorMetadata(yazar, parsePage(sayfa, authorPath({ slug: yazar })));
}

export default async function BlogAuthorPaginatedPage({ params }: Props) {
  const { yazar, sayfa } = await params;
  return <AuthorIndex slug={yazar} page={parsePage(sayfa, authorPath({ slug: yazar }))} />;
}

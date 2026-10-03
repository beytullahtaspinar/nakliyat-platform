import { BlogIndex, blogIndexMetadata, parsePage } from "@/components/blog/blog-routes";
import { BLOG_PATH } from "@/lib/blog/wordpress";

export const revalidate = 3600;

// Sayfalar derlemede üretilmez, ilk ziyarette üretilip önbelleğe alınır
export const dynamicParams = true;
export function generateStaticParams(): { sayfa: string }[] {
  return [];
}

type Props = { params: Promise<{ sayfa: string }> };

export async function generateMetadata({ params }: Props) {
  return blogIndexMetadata(parsePage((await params).sayfa, BLOG_PATH));
}

export default async function BlogPaginatedPage({ params }: Props) {
  return <BlogIndex page={parsePage((await params).sayfa, BLOG_PATH)} />;
}

import { AuthorIndex, authorMetadata } from "@/components/blog/blog-routes";

export const revalidate = 900;

export const dynamicParams = true;
export function generateStaticParams(): { yazar: string }[] {
  return [];
}

type Props = { params: Promise<{ yazar: string }> };

export async function generateMetadata({ params }: Props) {
  return authorMetadata((await params).yazar, 1);
}

export default async function BlogAuthorPage({ params }: Props) {
  return <AuthorIndex slug={(await params).yazar} page={1} />;
}

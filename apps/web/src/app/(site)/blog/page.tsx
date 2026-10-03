import { BlogIndex, blogIndexMetadata } from "@/components/blog/blog-routes";

// WordPress'te yazı yayınlanınca /api/blog/yenile önbelleği hemen bitirir; yoksa saatte bir yenilenir
export const revalidate = 3600;

export const generateMetadata = () => blogIndexMetadata(1);

export default function BlogPage() {
  return <BlogIndex page={1} />;
}

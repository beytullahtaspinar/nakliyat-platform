import { BlogIndex, blogIndexMetadata } from "@/components/blog/blog-routes";

// Yönetimde yazı kaydedilince önbellek hemen biter; zamanlanmış yazılar için en geç 15 dakikada bir yenilenir
export const revalidate = 900;

export const generateMetadata = () => blogIndexMetadata(1);

export default function BlogPage() {
  return <BlogIndex page={1} />;
}

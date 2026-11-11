import { ServiceLanding, serviceMetadata } from "@/components/local/service-landing";

// Fiyat tablosu katsayılarla, metinler yönetimden kaydedilince yenilenir
export const revalidate = 3600;

export const generateMetadata = () => serviceMetadata("ogrenci-tasima");

export default function Page() {
  return <ServiceLanding slug="ogrenci-tasima" />;
}

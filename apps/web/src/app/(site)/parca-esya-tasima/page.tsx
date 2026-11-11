import { ServiceLanding, serviceMetadata } from "@/components/local/service-landing";

// Fiyat tablosu katsayılarla, metinler yönetimden kaydedilince yenilenir
export const revalidate = 3600;

export const generateMetadata = () => serviceMetadata("parca-esya-tasima");

export default function Page() {
  return <ServiceLanding slug="parca-esya-tasima" />;
}

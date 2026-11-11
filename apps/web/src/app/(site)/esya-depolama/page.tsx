import { ServiceLanding, serviceMetadata } from "@/components/local/service-landing";

// Fiyat tablosu katsayılarla, metinler yönetimden kaydedilince yenilenir
export const revalidate = 3600;

export const generateMetadata = () => serviceMetadata("esya-depolama");

export default function Page() {
  return <ServiceLanding slug="esya-depolama" />;
}

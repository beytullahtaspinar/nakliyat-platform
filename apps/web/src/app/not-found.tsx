import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import SiteNotFound from "./(site)/not-found";

export { metadata } from "./(site)/not-found";

/** Hiçbir sayfaya uymayan adresler kök düzende açılır; site menüsü burada ayrıca eklenir. */
export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <SiteNotFound />
      <SiteFooter />
    </>
  );
}

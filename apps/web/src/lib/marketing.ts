/** Tanıtım sayfaları: üst menü, altbilgi, site haritası ve llms.txt aynı listeyi kullanır. */
export const MARKETING_PAGES = {
  about: { href: "/hakkimizda", label: "Hakkımızda" },
  howItWorks: { href: "/nasil-calisir", label: "Nasıl çalışır?" },
  forCompanies: { href: "/firmalar-icin", label: "Firmalar için" },
} as const;

export const MARKETING_LINKS = Object.values(MARKETING_PAGES);

/** Firma kaydının başladığı adres */
export const COMPANY_SIGNUP_PATH = "/kayit?rol=firma";

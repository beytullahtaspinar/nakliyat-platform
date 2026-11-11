import {
  SERVICE_PAGE_SLUGS,
  getCityByCode,
  getDistanceKm,
  routeSlug,
  type CityRecord,
  type ServicePageSlug,
} from "@nakliyat/locations";
import { estimatePrice, type HomeType, type LoadLevel, type PriceEstimate } from "@nakliyat/pricing";
import type { FaqItem } from "@/components/local/faq";
import { LAUNCH_CITIES } from "@/lib/local-seo";
import { DEFAULT_INPUT, formatTry, type PricingModel } from "@/lib/pricing";

/**
 * Hizmet sayfaları: ofis taşıma, parça eşya, asansörlü nakliyat, eşya depolama, öğrenci taşıma ve şehirler arası
 * nakliyat. Adresler kökte (@nakliyat/locations SERVICE_PAGE_SLUGS); başlık, giriş, kapak, ek içerik ve SSS
 * yönetimden (/yonetim/sayfalar) değiştirilebilir, boş alan buradaki otomatik metinle kalır.
 *
 * Fiyat tablosu yalnızca fiyat hesaplayıcının modeliyle gerçekten hesaplanabilen hizmetlerde var. Modelde karşılığı
 * olmayan kalemler (dış cephe asansörü ücreti, depo kirası, parsiyel yük) için sayı uydurulmaz.
 */

/** Tablo hücresi: modelin fiyat tahmini */
export type PriceCell = PriceEstimate;

export type ServicePriceTable = {
  title: string;
  /** Tablonun hangi varsayımlarla hesaplandığı */
  note: string;
  ariaLabel: string;
  columns: string[];
  /** info: fiyat dışı bilgi sütunu (ör. mesafe); varsa columns'un ikinci sırasındadır */
  rows: { label: string; href?: string; info?: string; cells: PriceCell[] }[];
};

export type ServiceSection = { title: string; paragraphs?: string[]; items?: string[] };

export type ServicePage = {
  slug: ServicePageSlug;
  /** Kısa ad: sayfa yolu, bağlantılar ve yönetim listesi */
  name: string;
  /** schema.org Service.serviceType */
  serviceType: string;
  metaTitle: (year: number) => string;
  description: (year: number) => string;
  heading: string;
  intro: string;
  priceTable?: (model: PricingModel) => ServicePriceTable;
  sections: ServiceSection[];
  faq: (ctx: { year: number; table?: ServicePriceTable }) => FaqItem[];
};

export const servicePath = (slug: ServicePageSlug) => `/${slug}`;

export const range = (e: PriceCell) => `${formatTry(e.minTry)} - ${formatTry(e.maxTry)}`;

/** Tablonun belirli hücresi metin olarak; tablo yoksa undefined */
const cell = (table: ServicePriceTable | undefined, row: number, col = 0) => {
  const c = table?.rows[row]?.cells[col];
  return c ? range(c) : undefined;
};

/** Örnek şehirler arası mesafe: en çok aranan güzergâh */
const IST = getCityByCode("34")!;
const ANK = getCityByCode("06")!;
const IST_ANK_KM = getDistanceKm(IST, ANK)!;

type Home = HomeType;

function estimator(model: PricingModel) {
  return (homeType: Home, opts: { load?: LoadLevel; distanceKm?: number; floor?: number; elevator?: boolean } = {}) =>
    estimatePrice(
      {
        ...DEFAULT_INPUT,
        homeType,
        load: opts.load ?? "NORMAL",
        distanceKm: opts.distanceKm,
        ...(opts.floor !== undefined && { fromFloor: opts.floor, toFloor: opts.floor }),
        ...(opts.elevator !== undefined && { fromHasElevator: opts.elevator, toHasElevator: opts.elevator }),
      },
      model.settings,
      model.calibration,
    );
}

/** Şehirler arası tablo: en çok taşınılan güzergâhlar; sayfası dizine açık olanlara bağlantı verilir */
const POPULAR_ROUTE_CODES: [string, string][] = [
  ["34", "06"],
  ["34", "35"],
  ["34", "07"],
  ["34", "16"],
  ["34", "41"],
  ["06", "35"],
  ["06", "07"],
  ["35", "07"],
];

const isLaunch = (city: CityRecord) => LAUNCH_CITIES.includes(city);

const COMMON_QUOTE_FAQ: FaqItem = {
  question: "Teklif almak ücretli mi, beni bağlar mı?",
  answer:
    "Hayır. Talep oluşturmak ve teklif almak ücretsizdir. Gelen teklifleri inceleyip dilediğinizi seçersiniz; hiçbirini kabul etmek zorunda değilsiniz.",
};

const COMMON_TRUST_FAQ: FaqItem = {
  question: "Firmalar nasıl doğrulanıyor?",
  answer:
    "Platformdaki firmalardan Ulaştırma ve Altyapı Bakanlığı K3 yetki belgesi, vergi levhası ve ticaret sicil kaydı istenir. Belgeleri onaylanmayan ya da K3 belgesinin süresi dolan firma teklif veremez. Yorumları yalnızca o firmayla platform üzerinden taşınan müşteriler yazabilir.",
};

const PAGES: Record<ServicePageSlug, ServicePage> = {
  "sehirler-arasi-nakliyat": {
    slug: "sehirler-arasi-nakliyat",
    name: "Şehirler arası nakliyat",
    serviceType: "Şehirler arası evden eve nakliyat",
    metaTitle: (y) => `Şehirler Arası Nakliyat Fiyatları ${y} ve Ücretsiz Teklif`,
    description: (y) =>
      `Şehirler arası nakliyat fiyatları ${y}: popüler güzergâhlarda tahmini fiyatlar, fiyatı belirleyen etkenler ve K3 belgeli, doğrulanmış firmalardan ücretsiz teklif.`,
    heading: "Şehirler arası nakliyat fiyatları ve teklif",
    intro:
      "Şehirler arası nakliyat, ev eşyalarınızın bir ilden başka bir ile kapalı kasa araçla taşınmasıdır. Fiyatı en çok mesafe, eşya hacmi, iki adresteki kat ve asansör durumu ile paketleme gibi ek hizmetler belirler. Bilgilerinizi bir kez girin; güzergâhınızda çalışan doğrulanmış firmalar size ücretsiz teklif göndersin.",
    priceTable: (model) => {
      const est = estimator(model);
      return {
        title: "Popüler güzergâhlarda şehirler arası nakliyat fiyatları",
        note: "2+1 ev, ortalama eşya, iki adreste de 2. kat ve asansörlü bina, paketleme ve montaj hariç; tam araç (eşya başka yükle birleştirilmeden) taşıma için tahmini aralık.",
        ariaLabel: "Güzergâha göre tahmini şehirler arası nakliyat fiyatları",
        columns: ["Güzergâh", "Mesafe", "2+1 ev"],
        rows: POPULAR_ROUTE_CODES.map(([a, b]) => {
          const from = getCityByCode(a)!;
          const to = getCityByCode(b)!;
          const km = getDistanceKm(from, to)!;
          return {
            label: `${from.name} - ${to.name}`,
            href: isLaunch(from) && isLaunch(to) ? `/${routeSlug(from, to)}` : undefined,
            info: `${km.toLocaleString("tr-TR")} km`,
            cells: [est("TWO_PLUS_ONE", { distanceKm: km })],
          };
        }),
      };
    },
    sections: [
      {
        title: "Şehirler arası nakliyat fiyatını neler belirler?",
        items: [
          "İki il arasındaki karayolu mesafesi ve aracın dönüş yolu",
          "Eşya hacmi (m³): eşyanız tek araca sığmıyorsa ikinci araç gerekir",
          "Çıkış ve varış adreslerindeki kat sayısı ve asansör durumu",
          "Paketleme, mobilya söküm-kurulum ve sigorta gibi ek hizmetler",
          "Eşyanın tam araçla mı yoksa başka yüklerle birlikte (parça eşya) mı taşınacağı",
          "Taşınma tarihi: ay sonu, hafta sonu ve yaz ayları daha yoğundur",
        ],
      },
      {
        title: "Tam araç mı, parça eşya mı?",
        paragraphs: [
          "Bütün bir evi taşıyorsanız araç yalnızca sizin eşyanıza ayrılır; yükleme ve teslim tarihi size göre planlanır. Az eşyanız varsa parça eşya (parsiyel) taşımada eşyanız aynı yöne giden başka yüklerle birlikte gider; genellikle daha ekonomiktir ama teslim süresi birkaç gün uzayabilir.",
        ],
      },
      {
        title: "Taşınmadan önce",
        items: [
          "Teklifleri taşınma tarihinden 2-4 hafta önce alın; yaz aylarında daha erken.",
          "Kırılacak ve değerli eşyaları ayrıca belirtin, fotoğraf ya da video ekleyin.",
          "Teslim tarihi, sigorta kapsamı ve paketleme dahil mi, teklifte yazılı olsun.",
        ],
      },
    ],
    faq: ({ year, table }) => [
      {
        question: `Şehirler arası nakliyat fiyatları ${year} yılında ne kadar?`,
        answer: `Fiyat güzergâha ve eşya miktarına göre değişir. Örneğin ${IST.name} - ${ANK.name} (yaklaşık ${IST_ANK_KM} km) arasında ortalama eşyalı bir 2+1 evin tahmini taşıma fiyatı ${cell(table, 0) ?? "tabloda"} aralığındadır. Kesin fiyatı firmalar eşyanızı ve adres koşullarını görerek verir.`,
      },
      {
        question: "Şehirler arası taşınma kaç gün sürer?",
        answer:
          "Tam araçla taşımada eşya çoğunlukla yükleme günü ya da ertesi gün teslim edilir; uzak güzergâhlarda 2-3 gün sürebilir. Parça eşya taşımada araç başka yükleri de topladığı için süre uzar. Kesin teslim tarihi firmanın teklifinde yazar.",
      },
      {
        question: "Eşyam az, daha uygun bir yol var mı?",
        answer:
          "Evet. Parça eşya (parsiyel) taşımada eşyanız aynı yöne giden başka yüklerle birlikte taşınır ve genellikle daha ekonomiktir. Talep formundaki notlara bunu yazarsanız firmalar buna göre teklif verir.",
      },
      COMMON_QUOTE_FAQ,
      COMMON_TRUST_FAQ,
    ],
  },

  "ofis-tasima": {
    slug: "ofis-tasima",
    name: "Ofis taşıma",
    serviceType: "Ofis ve iş yeri taşıma",
    metaTitle: (y) => `Ofis Taşıma Fiyatları ${y}: İş Yeri Taşıma Teklifi`,
    description: (y) =>
      `Ofis taşıma fiyatları ${y}: ofis büyüklüğüne göre tahmini fiyatlar, planlama adımları ve K3 belgeli, doğrulanmış nakliyat firmalarından ücretsiz iş yeri taşıma teklifi.`,
    heading: "Ofis taşıma fiyatları ve teklif",
    intro:
      "Ofis taşıma; masa, dolap, arşiv, bilgisayar ve diğer iş yeri eşyalarının sökülüp paketlenmesi, yeni adrese taşınması ve yeniden kurulmasıdır. İşinizin aksamaması için taşıma çoğunlukla hafta sonu ya da mesai dışında planlanır. Ofisinizin bilgilerini bir kez girin, doğrulanmış firmalar size ücretsiz teklif göndersin.",
    priceTable: (model) => {
      const est = estimator(model);
      const rows: { label: string; load: LoadLevel }[] = [
        { label: "Küçük ofis (az eşya)", load: "LIGHT" },
        { label: "Orta ofis", load: "NORMAL" },
        { label: "Büyük ofis (çok eşya)", load: "HEAVY" },
      ];
      return {
        title: "Ofis taşıma fiyatları",
        note: `Ofis büyüklüğüne göre tahmini aralık: iki adreste de 2. kat ve asansörlü bina, paketleme ve montaj hariç. Şehirler arası sütun ${IST.name} - ${ANK.name} (yaklaşık ${IST_ANK_KM} km) içindir.`,
        ariaLabel: "Ofis büyüklüğüne göre tahmini ofis taşıma fiyatları",
        columns: ["Ofis", "Şehir içi", "Şehirler arası"],
        rows: rows.map((r) => ({
          label: r.label,
          cells: [est("OFFICE", { load: r.load }), est("OFFICE", { load: r.load, distanceKm: IST_ANK_KM })],
        })),
      };
    },
    sections: [
      {
        title: "Ofis taşımayı planlama",
        items: [
          "Taşınma tarihini ve iş yerinin kapalı kalabileceği saatleri belirleyin; hafta sonu taşıma işin durmasını önler.",
          "Arşiv, evrak ve kişisel eşyaların koliye konmasını çalışanlarla paylaştırın, kolileri oda ve masa numarasıyla etiketleyin.",
          "Bilgisayar, sunucu ve yazıcıların kablolarını fotoğraflayıp ayrı paketleyin; verilerin yedeğini taşımadan önce alın.",
          "İki binanın yönetiminden yük asansörü kullanımı ve araç park izni isteyin.",
          "Teklif isterken masa, dolap ve koli sayısını, kat ve asansör bilgisini ve varsa ağır eşyaları (kasa, arşiv dolabı) belirtin.",
        ],
      },
      {
        title: "Ofis taşıma fiyatını neler belirler?",
        items: [
          "Eşya hacmi: masa, dolap ve arşiv miktarı",
          "Mobilya söküm-kurulum ve paketleme hizmeti",
          "Kat, asansör ve aracın binaya yaklaşabilmesi",
          "Mesai dışı ya da hafta sonu çalışma",
          "Şehir içi mi, şehirler arası mı",
        ],
      },
    ],
    faq: ({ year, table }) => [
      {
        question: `Ofis taşıma fiyatları ${year} yılında ne kadar?`,
        answer: `Orta büyüklükte bir ofisin şehir içi taşınmasının tahmini fiyatı ${cell(table, 1) ?? "tablodaki aralıkta"}; az eşyalı küçük bir ofis için ${cell(table, 0) ?? "daha düşük"} aralığındadır. Paketleme, söküm-kurulum ve kat durumu fiyatı değiştirir; kesin fiyatı firmalar ofisi görerek verir.`,
      },
      {
        question: "Ofis taşıma hafta sonu yapılabilir mi?",
        answer:
          "Evet. Talep formunda tarihi hafta sonu seçebilir, notlara mesai dışında çalışılması gerektiğini yazabilirsiniz. Firmalar buna göre teklif verir.",
      },
      {
        question: "Ofis taşıma ne kadar sürer?",
        answer:
          "Küçük bir ofis çoğunlukla bir günde taşınır. Büyük ofislerde, arşiv ve mobilya kurulumu da varsa iş birkaç güne bölünerek planlanır. Süreyi firmalar teklifte belirtir.",
      },
      COMMON_QUOTE_FAQ,
      COMMON_TRUST_FAQ,
    ],
  },

  "parca-esya-tasima": {
    slug: "parca-esya-tasima",
    name: "Parça eşya taşıma",
    serviceType: "Parça eşya (parsiyel) taşıma",
    metaTitle: (y) => `Parça Eşya Taşıma ${y}: Az Eşya İçin Uygun Nakliyat`,
    description: () =>
      "Parça eşya taşıma: birkaç koli, tek mobilya ya da beyaz eşya için şehir içi ve şehirler arası taşıma. Fiyatı belirleyen etkenler ve doğrulanmış firmalardan ücretsiz teklif.",
    heading: "Parça eşya taşıma",
    intro:
      "Parça eşya taşıma, bütün bir ev yerine birkaç koli, tek bir mobilya, beyaz eşya ya da öğrenci eşyası gibi az miktardaki eşyanın taşınmasıdır. Şehirler arası taşımada eşyanız aynı yöne giden başka yüklerle birlikte gidebilir (parsiyel taşıma); bu, tam araç kiralamaktan genellikle daha ekonomiktir. Ne taşıyacağınızı yazın, firmalar size ücretsiz teklif göndersin.",
    sections: [
      {
        title: "Parça eşya taşıma ne zaman uygun?",
        items: [
          "Tek bir oda ya da birkaç koli taşınacaksa",
          "Buzdolabı, çamaşır makinesi, koltuk ya da yatak gibi tek parça eşya alındıysa veya satıldıysa",
          "Öğrenci yurdu, apart ya da ikinci ev eşyası taşınacaksa",
          "Teslim tarihinde birkaç gün esneklik varsa (şehirler arası parsiyel taşımada)",
        ],
      },
      {
        title: "Fiyatı neler belirler?",
        items: [
          "Eşyanın türü, adedi ve hacmi (koli sayısı, mobilya ölçüleri)",
          "Mesafe; şehirler arası taşımada eşyanın tam araçla mı başka yüklerle mi gideceği",
          "Kat ve asansör durumu, taşımaya kaç kişinin gerektiği",
          "Paketleme ve söküm-kurulum ihtiyacı",
        ],
        paragraphs: [
          "Parça eşyada fiyat eşyanın kendisine göre değiştiği için sabit bir tablo vermiyoruz. Talep formunda eşyalarınızı tek tek yazmanız ve fotoğraf eklemeniz, firmaların doğru fiyat vermesini sağlar.",
        ],
      },
      {
        title: "Eşyayı hazırlarken",
        items: [
          "Kolileri ağzı bantlı ve üzerinde içeriği yazılı hazırlayın.",
          "Beyaz eşyanın suyunu boşaltın, kapaklarını bantlayın.",
          "Kırılacak eşyaları ayrı paketleyip firmaya söyleyin.",
        ],
      },
    ],
    faq: () => [
      {
        question: "Parça eşya taşıma fiyatı nasıl hesaplanır?",
        answer:
          "Eşyanın türüne, hacmine, mesafeye ve kat-asansör durumuna göre hesaplanır. Şehirler arası taşımada eşya başka yüklerle birlikte giderse fiyat tam araç kiralamaktan düşük olur. Eşyalarınızı ve fotoğraflarını eklediğiniz bir taleple firmalardan kesin fiyat alırsınız.",
      },
      {
        question: "Tek bir eşya (buzdolabı, koltuk) için teklif alabilir miyim?",
        answer:
          "Evet. Talep formunda ev tipi olarak en yakın seçeneği işaretleyin ve notlara yalnızca hangi eşyanın taşınacağını yazın. Firmalar buna göre teklif verir.",
      },
      {
        question: "Parsiyel taşıma ne kadar sürer?",
        answer:
          "Şehir içinde çoğunlukla aynı gün tamamlanır. Şehirler arası parsiyel taşımada araç aynı yöndeki yükleri topladığı için teslim birkaç gün sürebilir; kesin süre teklifte yazar.",
      },
      COMMON_QUOTE_FAQ,
      COMMON_TRUST_FAQ,
    ],
  },

  "asansorlu-nakliyat": {
    slug: "asansorlu-nakliyat",
    name: "Asansörlü nakliyat",
    serviceType: "Dış cephe asansörlü nakliyat",
    metaTitle: (y) => `Asansörlü Nakliyat Fiyatları ${y}: Dış Cephe Asansörü`,
    description: (y) =>
      `Asansörlü nakliyat ${y}: dış cephe (mobil) asansör ne zaman gerekir, kat ve asansörün fiyata etkisi ve doğrulanmış firmalardan ücretsiz asansörlü taşıma teklifi.`,
    heading: "Asansörlü nakliyat (dış cephe asansörü)",
    intro:
      "Asansörlü nakliyatta eşyalar merdivenden değil, binanın dışına kurulan mobil (dış cephe) asansörle pencere ya da balkondan indirilip çıkarılır. Yüksek katlarda, dar merdivenli binalarda ve büyük mobilyalarda taşımayı hızlandırır, eşyanın ve binanın zarar görme riskini azaltır. Kat ve asansör bilgilerinizi girin, firmalar size ücretsiz teklif göndersin.",
    priceTable: (model) => {
      const est = estimator(model);
      const homes: { label: string; value: Home }[] = [
        { label: "1+1", value: "ONE_PLUS_ONE" },
        { label: "2+1", value: "TWO_PLUS_ONE" },
        { label: "3+1", value: "THREE_PLUS_ONE" },
      ];
      return {
        title: "Kat ve asansörün fiyata etkisi",
        note: "Şehir içi taşıma, ortalama eşya, iki adreste de 5. kat; paketleme ve montaj hariç. Dış cephe asansörü ücreti bu tabloya dahil değildir: bölgeye, kata ve kurulum süresine göre değişir, firmalar teklifte ayrıca belirtir.",
        ariaLabel: "Bina asansörü olup olmamasına göre tahmini taşıma fiyatları",
        columns: ["Ev tipi", "Binada asansör var", "Asansörsüz (merdivenle)"],
        rows: homes.map((h) => ({
          label: h.label,
          cells: [est(h.value, { floor: 5, elevator: true }), est(h.value, { floor: 5, elevator: false })],
        })),
      };
    },
    sections: [
      {
        title: "Dış cephe asansörü ne zaman gerekir?",
        items: [
          "Bina asansörü yoksa ya da eşyalar bina asansörüne sığmıyorsa",
          "4. kat ve üzerinde, merdivenle taşımanın uzun ve riskli olduğu durumlarda",
          "Merdiven boşluğu dar, döner ya da yüksek basamaklıysa",
          "Köşe koltuk, gardırop, piyano gibi büyük ve ağır eşyalarda",
          "Bina yönetimi ortak alanlarda (merdiven, asansör) taşımaya izin vermiyorsa",
        ],
      },
      {
        title: "Kurulum için kontrol edin",
        items: [
          "Aracın ve asansörün binanın önüne kurulabileceği yer var mı? Elektrik ve telefon telleri, ağaçlar engel olabilir.",
          "Eşyaların geçeceği pencere ya da balkon yeterince geniş mi?",
          "Belediye ya da site yönetiminden yol veya park izni gerekiyor mu?",
          "Talep formunda kat bilgisini, bina asansörü olup olmadığını ve notlara dış cephe asansörü istediğinizi yazın.",
        ],
      },
    ],
    faq: ({ year, table }) => [
      {
        question: `Asansörlü nakliyat fiyatları ${year} yılında ne kadar?`,
        answer: `Dış cephe asansörü ücreti bölgeye, kata ve kurulum süresine göre değişir; firmalar teklifte ayrıca belirtir. Kıyas için: 5. katta 2+1 bir evin şehir içi taşıması binada asansör varsa yaklaşık ${cell(table, 1, 0) ?? "daha düşük"}, merdivenle taşınırsa ${cell(table, 1, 1) ?? "daha yüksek"} aralığındadır.`,
      },
      {
        question: "Hangi kattan itibaren asansörlü taşıma gerekir?",
        answer:
          "Kesin bir kural yok. Bina asansörü yoksa genellikle 3-4. kattan itibaren, büyük mobilyalarda daha alçak katlarda da tercih edilir. Kat bilgisini girdiğinizde firmalar gerekip gerekmediğini teklifte belirtir.",
      },
      {
        question: "Dış cephe asansörü her binaya kurulabilir mi?",
        answer:
          "Çoğu binaya kurulabilir; ancak önünde araç durabilecek yer olmayan, tel ya da ağaçla kapanan cephelerde kurulamayabilir. Notlara sokak ve bina durumunu yazmanız, fotoğraf eklemeniz firmanın doğru plan yapmasını sağlar.",
      },
      COMMON_QUOTE_FAQ,
      COMMON_TRUST_FAQ,
    ],
  },

  "esya-depolama": {
    slug: "esya-depolama",
    name: "Eşya depolama",
    serviceType: "Eşya depolama",
    metaTitle: (y) => `Eşya Depolama ${y}: Taşınırken Eşya Saklama Hizmeti`,
    description: () =>
      "Eşya depolama: taşınma tarihleri uyuşmadığında, tadilatta ya da yurt dışına giderken eşyaların depoda saklanması. Fiyatı belirleyen etkenler ve doğrulanmış firmalardan ücretsiz teklif.",
    heading: "Eşya depolama",
    intro:
      "Eşya depolama, ev eşyalarınızın paketlenip firmanın deposunda belirli bir süre saklanması ve istediğiniz tarihte yeni adresinize teslim edilmesidir. Eski evden çıkış ile yeni eve giriş tarihleri uyuşmadığında, tadilat sırasında ya da uzun süre şehir dışına giderken kullanılır. Talep formunda depolama seçeneğini işaretleyin, depolama hizmeti veren firmalar size teklif göndersin.",
    sections: [
      {
        title: "Ne zaman eşya depolamaya ihtiyaç olur?",
        items: [
          "Eski evden çıkış ile yeni eve giriş arasında günler ya da haftalar varsa",
          "Evde tadilat, boya ya da tamirat yapılacaksa",
          "Yurt dışına, askere ya da uzun süreli bir göreve gidiliyorsa",
          "Ev küçültülürken fazla eşya bir süre saklanacaksa",
        ],
      },
      {
        title: "Fiyatı neler belirler?",
        items: [
          "Eşya hacmi (m³) ve depolama süresi",
          "Paketleme hizmeti: depoda uzun süre kalacak eşyanın sağlam paketlenmesi önemlidir",
          "Eve gidiş ve depodan teslim için iki ayrı taşıma",
          "Depolama koşulları: kapalı ve kuru alan, güvenlik ve sigorta",
        ],
        paragraphs: [
          "Depolama ücreti firmaya, bölgeye ve süreye göre çok değiştiği için sabit bir fiyat vermiyoruz. Teklif isterken depolama süresini ve teslim tarihini yazmanız yeterlidir.",
        ],
      },
      {
        title: "Firmaya sorun",
        items: [
          "Depo kapalı, kuru ve kilitli mi; eşyalar sigortalı mı?",
          "Eşyalar diğer müşterilerin eşyasından ayrı mı (oda ya da kasa) saklanıyor?",
          "Süre uzarsa ya da erken teslim isterseniz ücret nasıl değişir?",
          "Depodaki eşyanın listesi (envanter) size teslim ediliyor mu?",
        ],
      },
    ],
    faq: () => [
      {
        question: "Eşya depolama fiyatı nasıl belirlenir?",
        answer:
          "Eşya hacmine, depolama süresine, paketleme ihtiyacına ve depoya gidiş-dönüş taşımalarına göre belirlenir. Firmalar aylık depolama ücretini ve taşıma ücretlerini teklifte ayrıca gösterebilir.",
      },
      {
        question: "Depolama hizmeti için nasıl teklif alırım?",
        answer:
          "Talep formundaki ek hizmetler bölümünde 'Eşyalarımın bir süre depoda kalması gerekiyor' seçeneğini işaretleyin, notlara tahmini süreyi ve teslim tarihini yazın. Depolama hizmeti veren firmalar buna göre teklif verir.",
      },
      {
        question: "Eşyalar depoda ne kadar süre kalabilir?",
        answer:
          "Birkaç günden birkaç aya, firmasına göre daha uzun süreye kadar. Süreyi ve süre uzarsa uygulanacak ücreti teklif aşamasında netleştirin.",
      },
      COMMON_QUOTE_FAQ,
      COMMON_TRUST_FAQ,
    ],
  },

  "ogrenci-tasima": {
    slug: "ogrenci-tasima",
    name: "Öğrenci taşıma",
    serviceType: "Öğrenci eşyası taşıma",
    metaTitle: (y) => `Öğrenci Taşıma Fiyatları ${y}: Öğrenci Evi ve Yurt Eşyası`,
    description: (y) =>
      `Öğrenci taşıma fiyatları ${y}: öğrenci evi, yurt ve apart eşyası için tahmini fiyatlar, uygun taşınma ipuçları ve doğrulanmış firmalardan ücretsiz teklif.`,
    heading: "Öğrenci taşıma fiyatları ve teklif",
    intro:
      "Öğrenci taşıma; yurt, apart ya da öğrenci evindeki az miktardaki eşyanın şehir içinde ya da memlekete taşınmasıdır. Eşya az olduğu için küçük bir araç ve iki kişilik ekip çoğunlukla yeter; şehirler arasında parça eşya taşıma daha da ekonomik olabilir. Bilgilerinizi girin, doğrulanmış firmalar size ücretsiz teklif göndersin.",
    priceTable: (model) => {
      const est = estimator(model);
      const rows: { label: string; value: Home }[] = [
        { label: "Yurt odası / stüdyo (az eşya)", value: "STUDIO" },
        { label: "1+1 öğrenci evi (az eşya)", value: "ONE_PLUS_ONE" },
        { label: "2+1 öğrenci evi (az eşya)", value: "TWO_PLUS_ONE" },
      ];
      return {
        title: "Öğrenci taşıma fiyatları",
        note: `Az eşya, iki adreste de 2. kat ve asansörlü bina, paketleme ve montaj hariç; tam araç için tahmini aralık. Şehirler arası sütun ${IST.name} - ${ANK.name} (yaklaşık ${IST_ANK_KM} km) içindir. Parça eşya olarak taşımada fiyat daha düşük olabilir.`,
        ariaLabel: "Ev tipine göre tahmini öğrenci taşıma fiyatları",
        columns: ["Ev tipi", "Şehir içi", "Şehirler arası"],
        rows: rows.map((r) => ({
          label: r.label,
          cells: [est(r.value, { load: "LIGHT" }), est(r.value, { load: "LIGHT", distanceKm: IST_ANK_KM })],
        })),
      };
    },
    sections: [
      {
        title: "Öğrenci taşımada fiyatı düşürmenin yolları",
        items: [
          "Eşyayı kendiniz koliye koyun; paketleme hizmeti istemezseniz fiyat düşer.",
          "Dönem sonu ve eylül başı çok yoğundur; tarihi birkaç gün öne ya da arkaya alabiliyorsanız 'tarihim esnek' seçeneğini işaretleyin.",
          "Şehirler arası taşımada eşya azsa notlara parça eşya taşımaya açık olduğunuzu yazın.",
          "Ev arkadaşlarınızla aynı gün taşınıyorsanız tek taleple birlikte teklif alın.",
        ],
      },
      {
        title: "Yurt ve apart çıkışında",
        items: [
          "Yurt ya da apart yönetiminden araç giriş saatlerini öğrenin.",
          "Buzdolabı, çamaşır makinesi gibi beyaz eşya varsa talepte belirtin.",
          "Depozito iadesi için odanın teslim fotoğraflarını çekin.",
        ],
      },
    ],
    faq: ({ year, table }) => [
      {
        question: `Öğrenci taşıma fiyatları ${year} yılında ne kadar?`,
        answer: `Az eşyalı bir yurt odası ya da stüdyonun şehir içi taşınmasının tahmini fiyatı ${cell(table, 0) ?? "tablodaki aralıkta"}; az eşyalı 1+1 bir öğrenci evi için ${cell(table, 1) ?? "biraz daha yüksek"} aralığındadır. Kesin fiyatı firmalar eşyanızı görerek verir.`,
      },
      {
        question: "Öğrenci eşyasını memlekete en uygun nasıl gönderirim?",
        answer:
          "Eşya azsa parça eşya (parsiyel) taşıma en ekonomik yoldur: eşyanız aynı yöne giden başka yüklerle birlikte gider. Talep formundaki notlara bunu yazarsanız firmalar buna göre teklif verir.",
      },
      {
        question: "Öğrenci taşıma için ne kadar önceden teklif almalıyım?",
        answer:
          "Haziran sonu ve eylül başı gibi yoğun dönemlerde en az 2-3 hafta önce teklif almanız uygun tarih ve fiyat bulmanızı kolaylaştırır.",
      },
      COMMON_QUOTE_FAQ,
      COMMON_TRUST_FAQ,
    ],
  },
};

export function getServicePage(slug: ServicePageSlug): ServicePage {
  return PAGES[slug];
}

/** Tüm hizmet sayfaları, SERVICE_PAGE_SLUGS sırasıyla (menü, altbilgi, site haritası) */
export const SERVICE_PAGES: ServicePage[] = SERVICE_PAGE_SLUGS.map((slug) => PAGES[slug]);

export const SERVICE_LINKS = SERVICE_PAGES.map((p) => ({ href: servicePath(p.slug), label: p.name }));

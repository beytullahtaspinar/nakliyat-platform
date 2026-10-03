<?php
/**
 * Plugin Name: evdenevenakliyat.app headless blog
 * Description: WordPress yalnızca editör olarak çalışır. Yazılar evdenevenakliyat.app/blog adresinde yayınlanır.
 * Version: 1.0.0
 *
 * Kurulum: bu dosyayı WordPress'te wp-content/mu-plugins/ klasörüne yükle (klasör yoksa oluştur).
 * "Must-use" eklentiler otomatik etkin olur, kapatılamaz. Ayrıntılar: docs/blog-wordpress.md
 *
 * wp-config.php içine ("That's all, stop editing!" satırından önce):
 *   define('NAKLIYAT_SITE_URL', 'https://evdenevenakliyat.app');
 *   define('NAKLIYAT_YENILEME_ANAHTARI', 'web uygulamasındaki BLOG_REVALIDATE_SECRET ile aynı değer');
 *
 * Yaptıkları:
 * 1. Yazı yayınlanınca, güncellenince, silinince veya kategori değişince siteye haber verir: sayfa hemen yenilenir.
 * 2. WordPress'in kendi sayfalarını (cms. alt alanı) ziyaret edenleri sitedeki aynı sayfaya yönlendirir,
 *    arama motorlarına kapatır. Önizleme ve yönetim paneli çalışmaya devam eder.
 * 3. Paneldeki "Yazıyı görüntüle" bağlantıları sitedeki adresi açar.
 * 4. Yeni yazının kısa adında (slug) Türkçe harfleri sadeleştirir: "taşınma" → "tasinma".
 */

if (!defined('ABSPATH')) {
    exit;
}

function nakliyat_site_url(): string
{
    return rtrim(defined('NAKLIYAT_SITE_URL') ? NAKLIYAT_SITE_URL : 'https://evdenevenakliyat.app', '/');
}

// ─── 1. Siteye "içerik değişti" bildirimi ──────────────────────────────────

function nakliyat_yenileme_iste(): void
{
    static $planlandi = false;
    if ($planlandi || !defined('NAKLIYAT_YENILEME_ANAHTARI')) {
        return;
    }
    $planlandi = true;
    // Bir kayıtta birden çok kanca çalışır: istek, sayfa isteğinin sonunda bir kez gönderilir
    add_action('shutdown', function () {
        wp_remote_post(nakliyat_site_url() . '/api/blog/yenile', [
            'headers' => ['Authorization' => 'Bearer ' . NAKLIYAT_YENILEME_ANAHTARI],
            'timeout' => 5,
            'blocking' => false,
        ]);
    });
}

add_action('transition_post_status', function ($yeni, $eski, $yazi) {
    // Yalnızca yayında olan ya da yayından kalkan yazılar siteyi etkiler
    if ($yazi->post_type === 'post' && ($yeni === 'publish' || $eski === 'publish')) {
        nakliyat_yenileme_iste();
    }
}, 10, 3);

add_action('before_delete_post', function ($id) {
    if (get_post_type($id) === 'post' && get_post_status($id) === 'publish') {
        nakliyat_yenileme_iste();
    }
});

foreach (['created_category', 'edited_category', 'delete_category', 'profile_update'] as $kanca) {
    add_action($kanca, 'nakliyat_yenileme_iste');
}

// ─── 2. WordPress'in kendi sayfaları: yönlendir ve dizine kapat ────────────

add_action('template_redirect', function () {
    if (is_admin() || is_preview() || wp_doing_ajax() || wp_doing_cron() || (defined('REST_REQUEST') && REST_REQUEST)) {
        return;
    }
    $site = nakliyat_site_url();
    if (is_feed()) {
        $hedef = $site . '/blog/rss.xml';
    } elseif (is_singular('post')) {
        $hedef = $site . '/blog/' . get_post_field('post_name', get_queried_object_id());
    } elseif (is_category()) {
        $hedef = $site . '/blog/kategori/' . get_queried_object()->slug;
    } else {
        $hedef = $site . '/blog';
    }
    wp_redirect($hedef, 301, 'evdenevenakliyat.app');
    exit;
});

add_action('send_headers', function () {
    header('X-Robots-Tag: noindex, nofollow', true);
});
add_filter('wp_robots', fn () => ['noindex' => true, 'nofollow' => true]);

// WordPress'in kendi site haritası kapalı (sitenin haritası: evdenevenakliyat.app/sitemap.xml)
add_filter('wp_sitemaps_enabled', '__return_false');

// ─── 3. Paneldeki bağlantılar sitedeki adresi açsın ───────────────────────

add_filter('post_link', function ($link, $yazi) {
    return $yazi->post_status === 'publish' ? nakliyat_site_url() . '/blog/' . $yazi->post_name : $link;
}, 10, 2);

add_filter('term_link', function ($link, $terim, $taksonomi) {
    return $taksonomi === 'category' ? nakliyat_site_url() . '/blog/kategori/' . $terim->slug : $link;
}, 10, 3);

// ─── 4. Türkçe harfler kısa adda sadeleşir ────────────────────────────────

add_filter('sanitize_title', function ($baslik, $ham = '', $baglam = 'display') {
    if ($baglam !== 'save') {
        return $baslik;
    }
    return strtr($baslik, [
        'ç' => 'c', 'Ç' => 'c', 'ğ' => 'g', 'Ğ' => 'g', 'ı' => 'i', 'İ' => 'i',
        'ö' => 'o', 'Ö' => 'o', 'ş' => 's', 'Ş' => 's', 'ü' => 'u', 'Ü' => 'u',
        'â' => 'a', 'Â' => 'a', 'î' => 'i', 'Î' => 'i', 'û' => 'u', 'Û' => 'u',
    ]);
}, 9, 3);

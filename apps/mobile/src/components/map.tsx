import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { AppText, Button } from '@/components/ui';
import { describePoint, MAP_STYLE_URL, searchPlaces, TURKEY_CENTER, type LatLng, type Place } from '@/lib/geo';
import { colors, fonts, radius } from '@/theme';

// Sitedeki harita ile aynı kütüphane ve sürüm (apps/web/package.json); WebView içinde CDN'den yüklenir
const MAPLIBRE = 'https://unpkg.com/maplibre-gl@5.24.0/dist';
const FROM_COLOR = colors.brand700;
const TO_COLOR = colors.accent500;

type MapConfig = {
  mode: 'route' | 'pick';
  from?: LatLng | null;
  to?: LatLng | null;
  center?: LatLng;
  zoom?: number;
};

/**
 * Harita sayfası: MapLibre + OpenFreeMap (anahtarsız). Uygulama ile postMessage üzerinden konuşur.
 * route: salt okunur, çıkış ve varış işaretleri. pick: dokunarak ya da sürükleyerek tek işaret.
 */
function mapHtml(config: MapConfig) {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="${MAPLIBRE}/maplibre-gl.css">
<style>html,body,#map{margin:0;height:100%;background:#f4f4f5}.maplibregl-ctrl-attrib{font-size:10px}</style>
</head><body><div id="map"></div>
<script src="${MAPLIBRE}/maplibre-gl.js"></script>
<script>
(function(){
  var cfg=${JSON.stringify(config)};
  var send=function(m){window.ReactNativeWebView.postMessage(JSON.stringify(m));};
  if(!window.maplibregl){send({type:'error'});return;}
  var pts=[cfg.from,cfg.to].filter(Boolean);
  var start=cfg.center||pts[0]||${JSON.stringify(TURKEY_CENTER)};
  var map=new maplibregl.Map({container:'map',style:'${MAP_STYLE_URL}',center:[start.lng,start.lat],
    zoom:cfg.zoom||(pts.length?15:5),interactive:cfg.mode==='pick',attributionControl:{compact:true}});
  map.on('error',function(){});
  map.on('load',function(){send({type:'ready'});});
  if(cfg.mode==='route'){
    if(cfg.from)new maplibregl.Marker({color:'${FROM_COLOR}'}).setLngLat([cfg.from.lng,cfg.from.lat]).addTo(map);
    if(cfg.to)new maplibregl.Marker({color:'${TO_COLOR}'}).setLngLat([cfg.to.lng,cfg.to.lat]).addTo(map);
    if(pts.length===2){var b=new maplibregl.LngLatBounds();pts.forEach(function(p){b.extend([p.lng,p.lat]);});
      map.fitBounds(b,{padding:40,maxZoom:15,duration:0});}
    return;
  }
  var pin=new maplibregl.Marker({color:'${FROM_COLOR}',draggable:true});
  var place=function(p){pin.setLngLat([p.lng,p.lat]).addTo(map);};
  if(cfg.from)place(cfg.from);
  var picked=function(ll){send({type:'pick',lat:ll.lat,lng:ll.lng});};
  pin.on('dragend',function(){picked(pin.getLngLat());});
  map.on('click',function(e){place(e.lngLat);picked(e.lngLat);});
  // Uygulamadan gelen komutlar: arama sonucuna git
  window.nkGo=function(p,zoom,mark){if(mark)place(p);map.jumpTo({center:[p.lng,p.lat],zoom:zoom});};
})();
</script></body></html>`;
}

/** Salt okunur küçük harita: çıkış lacivert, varış turuncu işaret */
export function RouteMapView({ from, to, height = 180 }: { from: LatLng | null; to: LatLng | null; height?: number }) {
  // Nesne kimliği değil koordinatlar önemli; aynı noktalar için harita yeniden yüklenmez
  const key = JSON.stringify([from, to]);
  const html = useMemo(() => mapHtml({ mode: 'route', from, to }), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const [failed, setFailed] = useState(false);
  if (!from && !to) return null;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={from && to ? 'Çıkış ve varış noktaları haritası' : 'İşaretlenen konumun haritası'}
      style={{ height, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.zinc200, backgroundColor: colors.zinc100 }}
    >
      {failed ? (
        <MapUnavailable />
      ) : (
        <WebView
          source={{ html }}
          originWhitelist={['*']}
          scrollEnabled={false}
          pointerEvents="none"
          onMessage={(e) => parse(e)?.type === 'error' && setFailed(true)}
          onError={() => setFailed(true)}
          style={{ backgroundColor: colors.zinc100 }}
        />
      )}
      {from && to ? (
        <View style={{ position: 'absolute', left: 8, bottom: 8, flexDirection: 'row', gap: 6 }}>
          <Legend color={FROM_COLOR} label="Çıkış" />
          <Legend color={TO_COLOR} label="Varış" />
        </View>
      ) : null}
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.white, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <AppText weight="medium" style={{ fontSize: 12, lineHeight: 16 }}>
        {label}
      </AppText>
    </View>
  );
}

function MapUnavailable() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, gap: 6 }}>
      <Ionicons name="map-outline" size={28} color={colors.zinc500} />
      <AppText style={{ color: colors.zinc600, textAlign: 'center', fontSize: 14 }}>Harita yüklenemedi. Bağlantını kontrol et.</AppText>
    </View>
  );
}

const parse = (e: WebViewMessageEvent): { type: string; lat?: number; lng?: number } | null => {
  try {
    return JSON.parse(e.nativeEvent.data) as { type: string; lat?: number; lng?: number };
  } catch {
    return null;
  }
};

export type PickedLocation = LatLng & { label: string | null; street: string | null };

/**
 * Tam ekran konum seçici: adres arama + haritaya dokunma/sürükleme.
 * address ve area ile açılır; yazılan adres bulunursa iğne oraya konur.
 */
export function LocationPicker({
  visible,
  title,
  value,
  address,
  area,
  onClose,
  onPick,
}: {
  visible: boolean;
  title: string;
  value: LatLng | null;
  address: string;
  area: string;
  onClose: () => void;
  onPick: (location: PickedLocation) => void;
}) {
  const web = useRef<WebView>(null);
  const lookup = useRef<AbortController | null>(null);
  const [text, setText] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [point, setPoint] = useState<PickedLocation | null>(null);
  const [failed, setFailed] = useState(false);
  // Harita bir kez kurulur; sonraki konumlar komutla gönderilir
  const html = useMemo(() => (visible ? mapHtml({ mode: 'pick', from: value, zoom: value ? 16 : undefined }) : ''), [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!visible) return;
    setText([address.trim(), area].filter(Boolean).join(', '));
    setResults([]);
    setFailed(false);
    setPoint(value ? { ...value, label: null, street: null } : null);
    setMessage(value ? 'İğneyi sürükleyerek ya da haritaya dokunarak yerini düzeltebilirsin.' : null);
    return () => lookup.current?.abort();
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (p: LatLng, zoom: number, mark: boolean) =>
    web.current?.injectJavaScript(`window.nkGo&&window.nkGo(${JSON.stringify({ lat: p.lat, lng: p.lng })},${zoom},${mark});true;`);

  /** Açılışta: yazılan adres bulunursa iğne oraya, bulunamazsa ilçeye odaklan */
  async function locateInitial() {
    if (value) return;
    try {
      const [found] = address.trim().length >= 5 ? await searchPlaces(`${address}, ${area}`) : [];
      if (found) {
        go(found, 17, true);
        setPoint({ lat: found.lat, lng: found.lng, label: found.label, street: null });
        setMessage('Yazdığın adrese göre işaretlendi. Tam yer değilse iğneyi sürükle ya da haritaya dokun.');
        return;
      }
      const [focus] = area ? await searchPlaces(area) : [];
      if (focus) go(focus, 13, false);
      setMessage('Evinin yerine haritada dokunarak işaret koy ya da yukarıdan ara.');
    } catch {
      setMessage('Adres araması şu an çalışmıyor. Haritaya dokunarak işaret koyabilirsin.');
    }
  }

  function picked(p: LatLng, place?: Place) {
    lookup.current?.abort();
    if (place) return setPoint({ lat: p.lat, lng: p.lng, label: place.label, street: place.street });
    setPoint({ lat: p.lat, lng: p.lng, label: null, street: null });
    const ctrl = new AbortController();
    lookup.current = ctrl;
    describePoint(p, ctrl.signal)
      .then((found) => !ctrl.signal.aborted && found && setPoint({ lat: p.lat, lng: p.lng, label: found.label, street: found.street }))
      .catch(() => undefined);
  }

  async function search() {
    if (text.trim().length < 3) return;
    setSearching(true);
    setMessage(null);
    try {
      const found = await searchPlaces(text, point ?? undefined);
      setResults(found);
      if (found.length === 0) setMessage('Sonuç yok. Mahalle ve sokak adıyla dene ya da haritaya dokun.');
    } catch {
      setMessage('Adres araması şu an çalışmıyor. Haritaya dokunarak işaret koyabilirsin.');
    } finally {
      setSearching(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.zinc200 }}>
          <AppText weight="bold" accessibilityRole="header" style={{ flex: 1, fontSize: 17 }}>
            {title}
          </AppText>
          <Pressable accessibilityRole="button" accessibilityLabel="Kapat" hitSlop={8} onPress={onClose}>
            <Ionicons name="close" size={26} color={colors.zinc900} />
          </Pressable>
        </View>

        <View style={{ padding: 16, paddingBottom: 8, gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Mahalle, sokak veya bina adı"
              placeholderTextColor={colors.zinc500}
              accessibilityLabel="Haritada adres ara"
              returnKeyType="search"
              onSubmitEditing={() => void search()}
              autoCorrect={false}
              style={{
                flex: 1,
                minHeight: 48,
                borderWidth: 1,
                borderColor: colors.zinc300,
                borderRadius: radius.md,
                paddingHorizontal: 14,
                fontSize: 16,
                fontFamily: fonts.regular,
                color: colors.zinc900,
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ara"
              onPress={() => void search()}
              disabled={searching}
              style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: colors.brand700, alignItems: 'center', justifyContent: 'center' }}
            >
              {searching ? <ActivityIndicator color={colors.white} /> : <Ionicons name="search" size={22} color={colors.white} />}
            </Pressable>
          </View>
          {message ? <AppText style={{ color: colors.zinc600, fontSize: 13, lineHeight: 18 }}>{message}</AppText> : null}
        </View>

        <View style={{ flex: 1 }}>
          {failed ? (
            <MapUnavailable />
          ) : visible ? (
            <WebView
              ref={web}
              source={{ html }}
              originWhitelist={['*']}
              onMessage={(e) => {
                const m = parse(e);
                if (m?.type === 'ready') void locateInitial();
                else if (m?.type === 'error') setFailed(true);
                else if (m?.type === 'pick' && m.lat != null && m.lng != null) picked({ lat: m.lat, lng: m.lng });
              }}
              onError={() => setFailed(true)}
              style={{ backgroundColor: colors.zinc100 }}
            />
          ) : null}
          {results.length ? (
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 16,
                right: 16,
                maxHeight: 280,
                backgroundColor: colors.white,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.zinc200,
                elevation: 4,
                shadowColor: '#000',
                shadowOpacity: 0.12,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 },
              }}
            >
              <FlatList
                data={results}
                keyExtractor={(r) => `${r.lat},${r.lng}`}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      go(item, 17, true);
                      picked(item, item);
                      setResults([]);
                    }}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      gap: 10,
                      alignItems: 'center',
                      padding: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.zinc100,
                      backgroundColor: pressed ? colors.brand50 : colors.white,
                    })}
                  >
                    <Ionicons name="location-outline" size={18} color={colors.brand700} />
                    <AppText style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>{item.label}</AppText>
                  </Pressable>
                )}
              />
            </View>
          ) : null}
        </View>

        <View style={{ padding: 16, gap: 10, borderTopWidth: 1, borderTopColor: colors.zinc200 }}>
          <AppText style={{ color: point ? colors.zinc900 : colors.zinc600, fontSize: 14, lineHeight: 20 }} numberOfLines={2}>
            {point ? (point.label ? `İşaretlenen yer: ${point.label}` : 'Yer işaretlendi.') : 'Henüz işaret yok. Haritaya dokunarak işaretle.'}
          </AppText>
          <Button
            title="Bu konumu kullan"
            icon="checkmark"
            disabled={!point}
            onPress={() => {
              if (!point) return;
              onPick(point);
              onClose();
            }}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

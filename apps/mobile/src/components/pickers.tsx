import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '@/components/ui';
import { formatDayTitle, formatMonth, monthGrid, shiftMonth, WEEKDAYS_SHORT } from '@/lib/calendar';
import { colors, fonts, radius } from '@/theme';

export type Option<T> = { value: T; label: string };

/** Türkçe büyük/küçük harf ve şapka farkı gözetmeden arama: "izmir" → "İzmir" */
const FOLD: Record<string, string> = { İ: 'i', I: 'i', ı: 'i', Ç: 'c', ç: 'c', Ğ: 'g', ğ: 'g', Ö: 'o', ö: 'o', Ş: 's', ş: 's', Ü: 'u', ü: 'u', Â: 'a', â: 'a', Î: 'i', î: 'i', Û: 'u', û: 'u' };
// Hermes'te normalize/yerele göre küçültmeye güvenmemek için elle eşleme
const fold = (text: string) => text.replace(/[İIıÇçĞğÖöŞşÜüÂâÎîÛû]/g, (c) => FOLD[c] ?? c).toLowerCase();

/** Seçim kutusu: dokununca tam ekran liste açılır; uzun listelerde arama alanı vardır */
export function SelectField<T extends string | number>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Seç',
  disabled,
  searchable,
}: {
  label: string;
  value: T | null;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = fold(query.trim());
    return q ? options.filter((o) => fold(o.label).includes(q)) : options;
  }, [options, query]);

  function close() {
    setOpen(false);
    setQuery('');
  }

  return (
    <View style={{ gap: 6 }}>
      <AppText weight="medium">{label}</AppText>
      <FieldButton
        label={label}
        text={selected?.label ?? placeholder}
        empty={!selected}
        disabled={disabled}
        icon="chevron-down"
        onPress={() => setOpen(true)}
      />
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
          <SheetHeader title={label} onClose={close} />
          {searchable ? (
            <View style={{ padding: 16, paddingBottom: 8 }}>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Ara"
                placeholderTextColor={colors.zinc500}
                accessibilityLabel={`${label} ara`}
                autoCorrect={false}
                style={inputStyle}
              />
            </View>
          ) : null}
          <FlatList
            data={filtered}
            keyExtractor={(o) => String(o.value)}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={30}
            renderItem={({ item }) => {
              const active = item.value === value;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    onChange(item.value);
                    close();
                  }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 20,
                    minHeight: 52,
                    backgroundColor: pressed ? colors.zinc100 : colors.white,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.zinc100,
                  })}
                >
                  <AppText weight={active ? 'semibold' : 'regular'} style={{ flex: 1, color: active ? colors.brand700 : colors.zinc900 }}>
                    {item.label}
                  </AppText>
                  {active ? <Ionicons name="checkmark" size={20} color={colors.brand700} /> : null}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <AppText style={{ color: colors.zinc600, textAlign: 'center', padding: 24 }}>Sonuç bulunamadı.</AppText>
            }
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

/** Tarih seçimi: ay takvimi; aralık dışındaki günler seçilemez. Değer "YYYY-AA-GG" */
export function DateField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: string;
  min: string;
  max: string;
  onChange: (day: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState((value || min).slice(0, 7));
  const days = monthGrid(month);

  return (
    <View style={{ gap: 6 }}>
      <AppText weight="medium">{label}</AppText>
      <FieldButton
        label={label}
        text={value ? formatDayTitle(value) : 'Tarih seç'}
        empty={!value}
        icon="calendar-outline"
        onPress={() => {
          setMonth((value || min).slice(0, 7));
          setOpen(true);
        }}
      />
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
          <SheetHeader title={label} onClose={() => setOpen(false)} />
          <View style={{ padding: 16, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <MonthButton icon="chevron-back" label="Önceki ay" disabled={month <= min.slice(0, 7)} onPress={() => setMonth(shiftMonth(month, -1))} />
              <AppText weight="bold" style={{ fontSize: 18 }}>
                {formatMonth(month)}
              </AppText>
              <MonthButton icon="chevron-forward" label="Sonraki ay" disabled={month >= max.slice(0, 7)} onPress={() => setMonth(shiftMonth(month, 1))} />
            </View>
            <View style={{ flexDirection: 'row' }}>
              {WEEKDAYS_SHORT.map((d) => (
                <AppText key={d} weight="semibold" style={{ flex: 1, textAlign: 'center', fontSize: 12, color: colors.zinc500 }}>
                  {d}
                </AppText>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {days.map((day) => {
                const inMonth = day.startsWith(month);
                const allowed = inMonth && day >= min && day <= max;
                const selected = day === value;
                return (
                  <Pressable
                    key={day}
                    accessibilityRole="button"
                    accessibilityLabel={formatDayTitle(day)}
                    accessibilityState={{ selected, disabled: !allowed }}
                    disabled={!allowed}
                    onPress={() => {
                      onChange(day);
                      setOpen(false);
                    }}
                    style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 3 }}
                  >
                    <View
                      style={{
                        flex: 1,
                        borderRadius: 10,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: selected ? colors.brand700 : 'transparent',
                      }}
                    >
                      <AppText
                        weight={selected ? 'bold' : 'regular'}
                        style={{ color: selected ? colors.white : allowed ? colors.zinc900 : colors.zinc300 }}
                      >
                        {inMonth ? Number(day.slice(8)) : ''}
                      </AppText>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function FieldButton({
  label,
  text,
  empty,
  disabled,
  icon,
  onPress,
}: {
  label: string;
  text: string;
  empty: boolean;
  disabled?: boolean;
  icon: 'chevron-down' | 'calendar-outline';
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${text}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 50,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: colors.zinc300,
        borderRadius: radius.md,
        paddingHorizontal: 14,
        backgroundColor: disabled ? colors.zinc100 : colors.white,
      }}
    >
      <AppText numberOfLines={1} style={{ flex: 1, fontSize: 16, color: empty ? colors.zinc500 : colors.zinc900 }}>
        {text}
      </AppText>
      <Ionicons name={icon} size={18} color={colors.zinc500} />
    </Pressable>
  );
}

function SheetHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        minHeight: 56,
        borderBottomWidth: 1,
        borderBottomColor: colors.zinc200,
      }}
    >
      <AppText weight="bold" accessibilityRole="header" style={{ flex: 1, fontSize: 18 }}>
        {title}
      </AppText>
      <Pressable accessibilityRole="button" accessibilityLabel="Kapat" hitSlop={8} onPress={onClose} style={{ padding: 6 }}>
        <Ionicons name="close" size={26} color={colors.zinc600} />
      </Pressable>
    </View>
  );
}

function MonthButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: 'chevron-back' | 'chevron-forward';
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.zinc200,
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <Ionicons name={icon} size={20} color={colors.brand700} />
    </Pressable>
  );
}

const inputStyle = {
  minHeight: 46,
  borderWidth: 1,
  borderColor: colors.zinc300,
  borderRadius: radius.md,
  paddingHorizontal: 14,
  fontSize: 16,
  fontFamily: fonts.regular,
  color: colors.zinc900,
} as const;

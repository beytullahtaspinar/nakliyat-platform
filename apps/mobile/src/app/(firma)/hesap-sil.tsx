import { DeleteAccountScreen } from '@/components/delete-account-screen';

export default function CompanyDeleteAccount() {
  return (
    <DeleteAccountScreen
      backLabel="Hesap"
      deleted={[
        'Adın, telefon numaran, e-posta adresin ve şifren',
        'Google ya da Apple bağlantın ve telefonlarındaki bildirim kayıtları',
        'Firma belgelerin ve tanıtım fotoğrafların',
        'Mesajlarının metni',
        'Bekleyen tekliflerin geri çekilir, firman listelerden kalkar',
      ]}
      kept="Müşterilerinin kayıtları bozulmasın diye iş geçmişi ve aldığın puanlar kalır. Ödeme gibi kanunen saklamamız gereken kayıtlar yasal süre boyunca saklanır."
    />
  );
}

import { DeleteAccountScreen } from '@/components/delete-account-screen';

export default function CustomerDeleteAccount() {
  return (
    <DeleteAccountScreen
      backLabel="Hesabım"
      deleted={[
        'Adın, telefon numaran, e-posta adresin ve şifren',
        'Google ya da Apple bağlantın ve telefonlarındaki bildirim kayıtları',
        'Taleplerine eklediğin fotoğraf ve videolar',
        'Mesajlarının ve yorumlarının metni',
        'Açık taleplerin iptal edilir',
      ]}
      kept="Firmaların kayıtları bozulmasın diye tamamlanan taşımaların ve verdiğin puanlar adsız olarak kalır. Kanunen saklamamız gereken kayıtlar yasal süre boyunca saklanır."
    />
  );
}

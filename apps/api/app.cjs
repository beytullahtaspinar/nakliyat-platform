// cPanel "Setup Node.js App" (Phusion Passenger) giriş dosyası.
// Passenger başlangıç dosyasını require() ile yüklediği için ESM derlemesini buradan açıyoruz.
import('./dist/main.js').catch((err) => {
  console.error(err);
  process.exit(1);
});

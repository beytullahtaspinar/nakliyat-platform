import { reportClientError } from "@/lib/client-errors";

// React dışında kalan tarayıcı hataları (olay işleyicileri, zamanlayıcılar, yakalanmamış promise'ler)
window.addEventListener("error", (event) => reportClientError(event.error ?? event.message, "window"));
window.addEventListener("unhandledrejection", (event) => reportClientError(event.reason, "promise"));

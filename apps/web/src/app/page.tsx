import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="max-w-xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Taşınmanı tek yerden planla
        </h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          Talebini bir kez gir, doğrulanmış nakliyat firmalarından teklifleri
          karşılaştır, sana en uygun olanı seç.
        </p>
        <Link
          href="/talep-olustur"
          className="mt-8 inline-block rounded-lg bg-blue-700 px-5 py-3 font-medium text-white hover:bg-blue-800"
        >
          Ücretsiz teklif al
        </Link>
        <p className="mt-6 text-sm text-zinc-500">
          <Link href="/evden-eve-nakliyat" className="underline">
            Hizmet verdiğimiz iller
          </Link>
        </p>
      </div>
    </main>
  );
}

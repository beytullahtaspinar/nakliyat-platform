import Link from "next/link";
import type { CompanyOverview, CompanyProfile } from "@/lib/api";

type Step = { title: string; hint: string; href?: string; done: boolean };

/** Firma kaydının adımları; tamamlanan adımlar işaretli, sıradaki adım vurgulu */
export function companyOnboardingSteps(profile: CompanyProfile | null, overview: CompanyOverview | null): Step[] {
  const docs = overview?.documents;
  const vehicles = overview?.vehicles;
  return [
    { title: "Firma bilgileri", hint: "Unvan, vergi no, hizmet illeri", href: profile ? "/firma-paneli/profil" : undefined, done: !!profile },
    {
      title: "Belgeler",
      hint: docs ? `K3, vergi levhası, ticaret sicil (${docs.requiredUploaded}/${docs.requiredTotal})` : "K3, vergi levhası, ticaret sicil",
      href: profile ? "/firma-paneli/belgeler" : undefined,
      done: !!docs && docs.requiredUploaded >= docs.requiredTotal,
    },
    {
      title: "Araç",
      hint: "Ruhsat + önden, yandan, arkadan foto",
      href: profile ? "/firma-paneli/araclar" : undefined,
      done: !!vehicles && vehicles.verified + vehicles.pending > 0,
    },
    { title: "Onay", hint: "Ekibimiz kontrol eder", done: profile?.verificationStatus === "VERIFIED" },
  ];
}

export function OnboardingSteps({ steps }: { steps: Step[] }) {
  const doneCount = steps.filter((s) => s.done).length;
  const current = steps.findIndex((s) => !s.done);
  return (
    <nav aria-label="Firma kaydı adımları" className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-semibold text-slate-900">
        Firma kaydı: {doneCount}/{steps.length} adım tamam
      </p>
      <ol className="mt-3 grid gap-2 sm:grid-cols-4">
        {steps.map((step, i) => {
          const isCurrent = i === current;
          const box = `flex h-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm ${
            step.done
              ? "border-green-200 bg-green-50"
              : isCurrent
                ? "border-accent-500 bg-accent-50"
                : "border-slate-200 bg-slate-50"
          }`;
          const content = (
            <>
              <span
                aria-hidden
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  step.done ? "bg-green-700 text-white" : isCurrent ? "bg-brand-700 text-white" : "bg-slate-300 text-slate-700"
                }`}
              >
                {step.done ? "✓" : i + 1}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-slate-900">
                  {step.title}
                  <span className="sr-only">{step.done ? " (tamam)" : isCurrent ? " (sıradaki adım)" : ""}</span>
                </span>
                <span className="block text-xs text-slate-600">{step.hint}</span>
              </span>
            </>
          );
          return (
            <li key={step.title} aria-current={isCurrent ? "step" : undefined}>
              {step.href && !step.done ? (
                <Link href={step.href} className={`${box} hover:border-slate-400`}>
                  {content}
                </Link>
              ) : (
                <div className={box}>{content}</div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

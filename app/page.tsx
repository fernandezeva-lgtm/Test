import { redirect } from "next/navigation";
import { Bot, Landmark, LineChart, ShieldCheck } from "lucide-react";
import { auth, demoLoginEnabled, googleEnabled, signIn } from "@/auth";
import { Logo } from "@/components/Logo";
import { BANKS } from "@/lib/banks";
import { BankAvatar } from "@/components/BankAvatar";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

const FEATURES = [
  { icon: Landmark, title: "Todos tus bancos", text: "Conecta tus cuentas de los principales bancos de España de forma segura." },
  { icon: LineChart, title: "Visión 360º", text: "Saldo total, gastos por categoría y movimientos en un único panel." },
  { icon: Bot, title: "Asistente con IA", text: "Pregunta en lenguaje natural: “¿cuánto gasté en restaurantes este mes?”." },
  { icon: ShieldCheck, title: "Solo lectura", text: "Acceso regulado PSD2 de solo lectura. Nunca podemos mover tu dinero." },
];

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="min-h-screen">
      <section className="hero-gradient relative overflow-hidden text-white">
        <div className="mx-auto max-w-6xl px-6 pb-28 pt-8">
          <nav className="flex items-center justify-between">
            <Logo light />
          </nav>

          <div className="mt-16 grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-star" /> Agregación bancaria + IA
              </span>
              <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
                Todas tus cuentas.
                <br />
                <span className="text-star">Un solo lugar.</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg text-white/85">
                Agrega tus cuentas bancarias, entiende en qué se va tu dinero y conversa con Finn, tu asistente
                financiero personal.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                {googleEnabled && (
                  <form action={async () => { "use server"; await signIn("google", { redirectTo: "/dashboard" }); }}>
                    <button className="inline-flex w-full items-center justify-center gap-3 rounded-full bg-white px-6 py-3.5 text-[15px] font-semibold text-ink shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:shadow-xl sm:w-auto">
                      <GoogleIcon /> Continuar con Google
                    </button>
                  </form>
                )}
                {demoLoginEnabled && (
                  <form action={async () => { "use server"; await signIn("demo", { redirectTo: "/dashboard" }); }}>
                    <button className="inline-flex w-full items-center justify-center rounded-full border border-white/40 px-6 py-3.5 text-[15px] font-semibold text-white transition hover:bg-white/10 sm:w-auto">
                      Entrar en modo demo
                    </button>
                  </form>
                )}
              </div>
              {!googleEnabled && (
                <p className="mt-3 text-xs text-white/70">Configura AUTH_GOOGLE_ID y AUTH_GOOGLE_SECRET para activar el acceso con Google.</p>
              )}
            </div>

            {/* Tarjeta de vista previa */}
            <div className="relative hidden lg:block">
              <div className="absolute -right-6 -top-6 h-40 w-40 rounded-full bg-star/30 blur-3xl" />
              <div className="relative rounded-[2rem] bg-white/95 p-6 text-ink shadow-2xl shadow-black/20">
                <p className="text-sm font-medium text-muted">Patrimonio neto</p>
                <p className="mt-1 text-4xl font-extrabold tracking-tight">24.318,42 €</p>
                <p className="mt-1 text-sm font-semibold text-emerald-600">+ 612,10 € este mes</p>
                <div className="mt-6 space-y-3">
                  {BANKS.slice(0, 3).map((b, i) => (
                    <div key={b.id} className="flex items-center gap-3 rounded-2xl bg-surface p-3">
                      <BankAvatar bankId={b.id} size="sm" />
                      <span className="flex-1 text-sm font-semibold">{b.name}</span>
                      <span className="text-sm font-bold">{["8.204,10 €", "12.930,00 €", "3.184,32 €"][i]}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-2xl bg-brand-50 p-4 text-sm">
                  <p className="font-semibold text-brand-700">Finn</p>
                  <p className="mt-1 text-ink/80">Este mes llevas 186 € en restaurantes, un 22 % menos que en septiembre. ¡Bien hecho! 🎉</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <svg className="absolute -bottom-px left-0 block w-full text-surface" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden>
          <path fill="currentColor" d="M0 80V40c240 30 480 40 720 30S1200 20 1440 40v40z" />
        </svg>
      </section>

      <section className="relative z-10 mx-auto -mt-10 max-w-6xl px-6 pb-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="card p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-500">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-bold">{title}</h3>
              <p className="mt-1.5 text-sm text-muted">{text}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-muted">Bancos disponibles</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {BANKS.map((b) => (
              <span key={b.id} className="card flex items-center gap-2.5 px-4 py-2.5 !rounded-full">
                <BankAvatar bankId={b.id} size="sm" />
                <span className="text-sm font-semibold">{b.name}</span>
              </span>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

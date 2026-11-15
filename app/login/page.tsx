import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import LoginForm from "@/components/login-form";
import AuthArt, { AuthBrand } from "@/components/auth-art";
import { databaseReady } from "@/lib/database";
import { appFont } from "@/lib/app-font";
import "@/app/app.css";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!(await databaseReady())) redirect("/setup?issue=database");
  if (await currentUser()) redirect("/dashboard");
  return (
    <div className={`app ${appFont.variable}`}>
      <div className="auth">
        <AuthArt />
        <main className="auth-panel">
          <div className="auth-box">
            <AuthBrand />
            <div className="stack-sm">
              <h1>Masuk</h1>
              <p className="muted">Pakai email dan kata sandi dari admin Anda.</p>
            </div>
            <LoginForm />
          </div>
        </main>
      </div>
    </div>
  );
}

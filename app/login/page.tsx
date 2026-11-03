import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import LoginForm from "@/components/login-form";
import { databaseReady } from "@/lib/database";
export default async function LoginPage() { if (!(await databaseReady())) redirect("/setup?issue=database"); if (await currentUser()) redirect("/dashboard"); return <main className="login-page"><div className="login-card"><div className="brand" style={{ padding:0,color:"#176b4a" }}>Newsroom <small style={{ color:"#65726c" }}>Central newsroom workspace</small></div><h1 style={{ marginTop:30 }}>Masuk ke ruang redaksi</h1><p className="subtitle" style={{ marginBottom:24 }}>Gunakan akun newsroom yang telah disiapkan oleh pemilik.</p><LoginForm /></div></main>; }

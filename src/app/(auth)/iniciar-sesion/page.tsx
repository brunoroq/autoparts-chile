import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { safeReturnPath } from "@/lib/http/input";
export const metadata: Metadata = { title: "Iniciar sesión" };
export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return <section className="container auth-page"><AuthForm callbackUrl={safeReturnPath(params.callbackUrl)} registered={params.registrado === "1"}/></section>;
}

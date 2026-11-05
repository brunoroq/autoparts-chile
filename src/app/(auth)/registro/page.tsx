import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { safeReturnPath } from "@/lib/http/input";
export const metadata: Metadata = { title: "Crear cuenta" };
export default async function Registration({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  return <section className="container auth-page"><AuthForm register callbackUrl={safeReturnPath(params.callbackUrl)}/></section>;
}

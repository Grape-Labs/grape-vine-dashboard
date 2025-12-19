// app/page.tsx
import { redirect } from "next/navigation";

export default function Home() {
  // Optional: set NEXT_PUBLIC_DEFAULT_DAO in .env
  const dao = process.env.NEXT_PUBLIC_DEFAULT_DAO;
  redirect(dao ? `/dao/${dao}` : "/dao");
}
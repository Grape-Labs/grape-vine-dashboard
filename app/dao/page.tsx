// app/dao/page.tsx
import { redirect } from "next/navigation";

export default function DaoIndexPage() {
  const dao = process.env.NEXT_PUBLIC_DEFAULT_DAO;
  redirect(dao ? `/dao/${dao}` : "/");
}
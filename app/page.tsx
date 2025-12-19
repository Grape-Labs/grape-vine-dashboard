// app/dao/page.tsx
import { redirect } from "next/navigation";

// app/dao/page.tsx
import ReputationDirectory from "./ReputationDirectory";

export default function DaoIndexPage() {
  const dao = process.env.NEXT_PUBLIC_DEFAULT_DAO;

  /*
  // If you have a configured default, keep the nice shortcut.
  if (dao?.trim()) redirect(`/dao/${dao.trim()}`);

  // Otherwise: go to directory / landing (root)
  redirect("/");
  */
  return <ReputationDirectory />;
}
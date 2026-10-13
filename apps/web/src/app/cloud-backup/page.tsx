import { notFound } from "next/navigation";
import { CloudBackupForm } from "@/components/cloud-backup-form";

export default function CloudBackupPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <CloudBackupForm />;
}

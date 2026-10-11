import { notFound } from "next/navigation";
import { CloudAuthTestForm } from "@/components/cloud-auth-test-form";

export default function CloudTestPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <CloudAuthTestForm />;
}

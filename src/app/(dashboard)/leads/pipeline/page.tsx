import { redirect } from "next/navigation";

export default function LeadPipelinePage() {
  redirect("/leads?tab=pipeline");
}

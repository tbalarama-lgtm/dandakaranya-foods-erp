import { redirect } from "next/navigation";

export default function ProductionPlanningRedirect() {
  redirect("/production/schedule");
}

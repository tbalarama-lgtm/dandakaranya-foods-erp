import { useParams } from "react-router-dom";
import type { GeoDashboardLevel } from "@shared/types";
import type { AppModel } from "../App";
import { GeoDashboardView } from "./GeoDashboardView";

export function AreaDashboardPage({
  model,
  level
}: {
  model: AppModel;
  level: Exclude<GeoDashboardLevel, "assembly">;
}): JSX.Element {
  const { id } = useParams();
  if (!id) return <p className="empty">Missing geographic unit.</p>;
  return <GeoDashboardView model={model} level={level} unitId={id} />;
}

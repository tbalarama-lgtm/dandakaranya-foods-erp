import { GeoDashboardView } from "./GeoDashboardView";
import type { AppModel } from "../App";

export function DashboardPage({ model }: { model: AppModel }): JSX.Element {
  return <GeoDashboardView model={model} level="assembly" />;
}

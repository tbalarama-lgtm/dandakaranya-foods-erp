export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export function actionOk<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionFail(error: string): ActionResult<never> {
  return { ok: false, error };
}

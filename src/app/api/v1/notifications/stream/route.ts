import { auth } from "@/auth";
import { getUnreadCount, getLatestNotificationTimestamp } from "@/lib/notifications";
import type { UserRole } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;
  const role = session.user.role as UserRole;

  let lastTs: Date | null = null;
  let lastUnread = -1;
  let closed = false;
  let interval: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      send("connected", { userId, ts: Date.now() });

      const poll = async () => {
        if (closed) return;
        try {
          const [unread, latest] = await Promise.all([
            getUnreadCount(userId, role),
            getLatestNotificationTimestamp(userId),
          ]);

          const tsChanged = latest && (!lastTs || latest.getTime() !== lastTs.getTime());
          const unreadChanged = unread !== lastUnread;

          if (unreadChanged || tsChanged) {
            send("update", { unread, latestAt: latest?.toISOString() ?? null, ts: Date.now() });
            lastTs = latest;
            lastUnread = unread;
          } else {
            send("heartbeat", { ts: Date.now() });
          }
        } catch {
          send("error", { message: "poll failed" });
        }
      };

      await poll();
      interval = setInterval(poll, 3000);

      request.signal.addEventListener("abort", () => {
        closed = true;
        if (interval) clearInterval(interval);
        try {
          controller.close();
        } catch {
          /* noop */
        }
      });
    },
    cancel() {
      closed = true;
      if (interval) clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

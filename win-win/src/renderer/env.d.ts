import type { WinWinApi } from "@shared/ipc";

declare global {
  interface Window {
    winwin: WinWinApi;
  }
}

export {};

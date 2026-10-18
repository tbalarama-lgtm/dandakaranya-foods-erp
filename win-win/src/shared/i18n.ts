export type MessageKey =
  | "appName"
  | "dashboard"
  | "elections"
  | "rural"
  | "urban"
  | "allWards"
  | "backup"
  | "settings"
  | "constituency"
  | "boundaryVersion"
  | "search"
  | "save"
  | "cancel"
  | "create"
  | "edit"
  | "archive"
  | "delete"
  | "confirm"
  | "emptyTitle"
  | "emptyBody"
  | "partial"
  | "complete"
  | "ruralLabel"
  | "urbanLabel"
  | "demoBanner"
  | "notEncrypted";

export const messages: Record<"en" | "te", Record<MessageKey, string>> = {
  en: {
    appName: "WIN WIN",
    dashboard: "Dashboard",
    elections: "Election Workspaces",
    rural: "Rural Areas",
    urban: "Urban Areas",
    allWards: "All Wards",
    backup: "Backup",
    settings: "Settings",
    constituency: "Assembly Constituency",
    boundaryVersion: "Boundary version",
    search: "Search",
    save: "Save",
    cancel: "Cancel",
    create: "Create",
    edit: "Edit",
    archive: "Archive",
    delete: "Delete",
    confirm: "Confirm",
    emptyTitle: "Nothing here yet",
    emptyBody: "Add records for the selected constituency, or load labelled demonstration data from Settings.",
    partial: "Partial coverage",
    complete: "Complete coverage",
    ruralLabel: "Rural",
    urbanLabel: "Urban",
    demoBanner: "Demonstration records — not official geography or personal data.",
    notEncrypted: "The database and backups are not encrypted."
  },
  te: {
    appName: "WIN WIN",
    dashboard: "డాష్‌బోర్డ్",
    elections: "ఎన్నికల వర్క్‌స్పేస్‌లు",
    rural: "గ్రామీణ ప్రాంతాలు",
    urban: "పట్టణ ప్రాంతాలు",
    allWards: "అన్ని వార్డులు",
    backup: "బ్యాకప్",
    settings: "సెట్టింగ్‌లు",
    constituency: "అసెంబ్లీ నియోజకవర్గం",
    boundaryVersion: "సరిహద్దు వెర్షన్",
    search: "వెతకండి",
    save: "సేవ్",
    cancel: "రద్దు",
    create: "సృష్టించు",
    edit: "సవరించు",
    archive: "ఆర్కైవ్",
    delete: "తొలగించు",
    confirm: "నిర్ధారించు",
    emptyTitle: "ఇంకా రికార్డులు లేవు",
    emptyBody: "ఎంచుకున్న నియోజకవర్గానికి రికార్డులు జోడించండి, లేదా సెట్టింగ్‌ల నుండి డెమో డేటా లోడ్ చేయండి.",
    partial: "పాక్షిక కవరేజీ",
    complete: "పూర్తి కవరేజీ",
    ruralLabel: "గ్రామీణ",
    urbanLabel: "పట్టణ",
    demoBanner: "ప్రదర్శన రికార్డులు — అధికారిక సరిహద్దులు లేదా వ్యక్తిగత డేటా కాదు.",
    notEncrypted: "డేటాబేస్ మరియు బ్యాకప్‌లు ఎన్‌క్రిప్ట్ కాలేదు."
  }
};

export function t(locale: "en" | "te", key: MessageKey): string {
  return messages[locale][key];
}

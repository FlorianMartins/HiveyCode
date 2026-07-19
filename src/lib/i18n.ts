"use client";

import { useStore } from "@/store/useStore";

export type Lang = "en" | "fr";

// UI string table. English is the source; French is the overlay. Add a key here + use t("key") in a
// component to make a label translatable. The active language is synced from the Hivey sidebar.
const DICT: Record<string, { en: string; fr: string }> = {
  // Landing / hero
  "landing.tagline": {
    en: "Describe an **app** — the Hivey agents **plan, code, test and ship** it.",
    fr: "Décris une **app** — les agents Hivey la **planifient, la codent, la testent et la livrent**.",
  },
  "landing.placeholder": {
    en: "Describe the app you want to build…",
    fr: "Décris l'application que tu veux créer…",
  },
  "landing.build": { en: "Build", fr: "Créer" },
  "landing.building": { en: "Building…", fr: "Création…" },
  "landing.needKey": {
    en: "Add your OpenRouter key (top-right) to start — it stays in your browser.",
    fr: "Ajoute ta clé OpenRouter (en haut à droite) pour démarrer — elle reste dans ton navigateur.",
  },
  // Chat composer
  "chat.placeholder": {
    en: "Ask for a change… (Enter to send, Shift+Enter for a new line)",
    fr: "Demande une modification… (Entrée pour envoyer, Maj+Entrée pour un saut de ligne)",
  },
  "chat.needKey": {
    en: "Add your OpenRouter API key (top right) to start.",
    fr: "Ajoute ta clé API OpenRouter (en haut à droite) pour démarrer.",
  },
  "chat.stopped": { en: "Stopped.", fr: "Arrêté." },
  "chat.runtimeError": { en: "Runtime error in the preview", fr: "Erreur d'exécution dans l'aperçu" },
  "chat.fixWithAgents": { en: "Fix with the agents", fr: "Corriger avec les agents" },
  // Topbar tooltips
  "topbar.export": { en: "Export project as a .zip", fr: "Exporter le projet en .zip" },
  "topbar.settings": { en: "Settings — appearance & sidebar", fr: "Réglages — apparence & sidebar" },
  "topbar.newProject": { en: "New project", fr: "Nouveau projet" },
  "topbar.menu": { en: "Projects & history", fr: "Projets & historique" },
  // Settings
  "settings.title": { en: "Settings", fr: "Réglages" },
  "settings.appearance": { en: "Appearance", fr: "Apparence" },
  "settings.colours": { en: "Colours", fr: "Couleurs" },
  "settings.surfaces": { en: "Surfaces & borders", fr: "Surfaces & bordures" },
  "settings.aura": { en: "Background aura", fr: "Aura de fond" },
  "settings.reset": { en: "Reset", fr: "Réinitialiser" },
  // Workbench phases
  "phase.plan": { en: "Plan", fr: "Plan" },
  "phase.code": { en: "Code", fr: "Code" },
  "phase.test": { en: "Test", fr: "Test" },
  "phase.fix": { en: "Fix", fr: "Correction" },
  // File tree context menu
  "tree.newFile": { en: "New file", fr: "Nouveau fichier" },
  "tree.newFolder": { en: "New folder", fr: "Nouveau dossier" },
  "tree.rename": { en: "Rename", fr: "Renommer" },
  "tree.duplicate": { en: "Duplicate", fr: "Dupliquer" },
  "tree.delete": { en: "Delete", fr: "Supprimer" },
};

export function translate(lang: Lang, key: string, fallback?: string): string {
  const entry = DICT[key];
  if (!entry) return fallback ?? key;
  return entry[lang] ?? entry.en ?? fallback ?? key;
}

// Hook: returns a t() bound to the current language; re-renders the component when the language changes.
export function useT(): (key: string, fallback?: string) => string {
  const lang = useStore((s) => s.lang);
  return (key, fallback) => translate(lang, key, fallback);
}

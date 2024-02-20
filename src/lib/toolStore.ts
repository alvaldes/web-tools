import type { WebTools, Tags } from "./notion";
import { atom, map } from "nanostores";

export const isLoading = atom(true);

export const toolItems = map<Record<string, WebTools>>({});

export const tagsItems = map<Record<string, Tags>>({});

export function saveToolItem(items: WebTools[]) {
  toolItems.set({});
  items.map((item) => {
    toolItems.setKey(item.id, item);
  });
}

export function saveTagItem(items: Tags[]) {
  tagsItems.set({});
  items.map((item) => {
    tagsItems.setKey(item.id, item);
  });
}

export function saveIsLoading(value: boolean) {
  isLoading.set(value);
}

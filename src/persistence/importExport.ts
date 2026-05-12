import type { Project } from "../types/project";
import { downloadFile } from "../export/download";
import { validateProject } from "./localStorage";

const PROJECT_MIME = "application/json";

export function saveProjectFile(project: Project): void {
  const safeName =
    project.name
      .trim()
      .replace(/[^A-Za-z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project";
  downloadFile(`${safeName}.json`, JSON.stringify(project, null, 2), PROJECT_MIME);
}

export function openProjectFile(): Promise<Project | null> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") {
      resolve(null);
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.style.position = "fixed";
    input.style.top = "-100px";
    document.body.appendChild(input);

    let done = false;
    const finish = (project: Project | null) => {
      if (done) return;
      done = true;
      input.remove();
      resolve(project);
    };

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) {
        finish(null);
        return;
      }
      try {
        const text = await file.text();
        const parsed: unknown = JSON.parse(text);
        finish(validateProject(parsed));
      } catch {
        finish(null);
      }
    });

    // Cancel handler — covers the "user dismissed the dialog" case in
    // browsers that support it (modern Chrome/Firefox/Safari).
    input.addEventListener("cancel", () => finish(null));

    input.click();
  });
}

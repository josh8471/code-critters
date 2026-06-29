import * as vscode from "vscode";
import { getWebviewContent } from "./webviewContent";

export interface PetSpec {
  type: string;
  color: string;
  name?: string;
}

export const PET_TYPES = ["cat", "dog", "duck", "robot", "unique"];

const NAMES = [
  "Pixel", "Biscuit", "Mochi", "Tofu", "Waffle", "Noodle", "Pepper",
  "Olive", "Ziggy", "Bean", "Marble", "Cosmo", "Suki", "Banjo",
  "Pumpkin", "Gizmo", "Maple", "Dottie", "Otto", "Nimbus",
];

export function randomName(): string {
  return NAMES[Math.floor(Math.random() * NAMES.length)];
}

export const COLORS: Record<string, string[]> = {
  cat: ["black", "white", "ginger", "gray", "brown"],
  dog: ["brown", "black", "white", "gold"],
  duck: ["yellow", "white"],
  robot: ["gray", "gold", "white", "black"],
  unique: [],
};

const STORAGE_KEY = "codeCritters.pets";

export class PetsViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewId = "codeCritters.petsView";

  private _view?: vscode.WebviewView;
  private _pets: PetSpec[];

  public onRenameRequest?: (index: number) => void;

  constructor(private readonly _context: vscode.ExtensionContext) {
    const saved = _context.globalState.get<PetSpec[]>(STORAGE_KEY);
    this._pets = saved ?? [{ type: "cat", color: "black", name: randomName() }];
    let changed = false;
    for (const p of this._pets) {
      if (!p.name) {
        p.name = randomName();
        changed = true;
      }
    }
    if (changed) {
      this._save();
    }
  }

  public resolveWebviewView(view: vscode.WebviewView) {
    this._view = view;
    const mediaRoot = vscode.Uri.joinPath(this._context.extensionUri, "media");
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [mediaRoot],
    };
    const mediaBase = view.webview.asWebviewUri(mediaRoot).toString();
    view.webview.html = getWebviewContent(view.webview, mediaBase);

    view.webview.onDidReceiveMessage((msg) => {
      if (msg?.type === "ready") {
        this._postInit();
      } else if (msg?.type === "renameRequest") {
        this.onRenameRequest?.(msg.index);
      }
    });

    view.onDidChangeVisibility(() => {
      if (view.visible) {
        this._postInit();
      }
    });

    this._postInit();
  }

  public getPets(): PetSpec[] {
    return [...this._pets];
  }

  public addPet(pet: PetSpec) {
    if (!pet.name) {
      pet.name = randomName();
    }
    this._pets.push(pet);
    this._save();
    this._view?.webview.postMessage({ type: "add", pet });
  }

  public renamePet(index: number, name: string) {
    if (index < 0 || index >= this._pets.length) {
      return;
    }
    this._pets[index].name = name;
    this._save();
    this._postInit();
  }

  public removePet(index: number) {
    if (index < 0 || index >= this._pets.length) {
      return;
    }
    this._pets.splice(index, 1);
    this._save();
    this._postInit();
  }

  public clearPets() {
    this._pets = [];
    this._save();
    this._view?.webview.postMessage({ type: "clear" });
  }

  public throwTreat() {
    this._view?.webview.postMessage({ type: "treat" });
  }

  public reportDiagnostics(errors: number, warnings: number) {
    this._view?.webview.postMessage({ type: "diag", errors, warnings });
  }

  public notifyCleanSave() {
    this._view?.webview.postMessage({ type: "save" });
  }

  public reveal() {
    this._view?.show?.(true);
  }

  public refresh() {
    this._postInit();
  }

  private _postInit() {
    const config = vscode.workspace.getConfiguration("codeCritters");
    const size = config.get<string>("size", "small");
    const showNames = config.get<boolean>("showNames", true);
    this._view?.webview.postMessage({
      type: "init",
      pets: this._pets,
      size,
      showNames,
    });
  }

  private _save() {
    this._context.globalState.update(STORAGE_KEY, this._pets);
  }
}

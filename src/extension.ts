import * as vscode from "vscode";
import { PetsViewProvider, PET_TYPES, COLORS, PetSpec } from "./petsView";

export function activate(context: vscode.ExtensionContext) {
  const provider = new PetsViewProvider(context);

  async function promptRename(index: number) {
    const pets = provider.getPets();
    const pet = pets[index];
    if (!pet) {
      return;
    }
    const name = await vscode.window.showInputBox({
      prompt: `Rename your ${pet.type}`,
      value: pet.name ?? "",
      validateInput: (v) =>
        v.trim().length === 0
          ? "Name can't be empty"
          : v.trim().length > 20
          ? "Keep it under 20 characters"
          : undefined,
    });
    if (name !== undefined) {
      provider.renamePet(index, name.trim());
    }
  }

  provider.onRenameRequest = (index) => {
    void promptRename(index);
  };

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      PetsViewProvider.viewId,
      provider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("codeCritters.spawn", async () => {
      const type = await vscode.window.showQuickPick(PET_TYPES, {
        placeHolder: "Pick a critter",
      });
      if (!type) {
        return;
      }
      const colors = COLORS[type] || [];
      let color = "custom";
      if (colors.length > 1) {
        const picked = await vscode.window.showQuickPick(colors, {
          placeHolder: `Pick a color for your ${type}`,
        });
        if (!picked) {
          return;
        }
        color = picked;
      } else if (colors.length === 1) {
        color = colors[0];
      }
      provider.addPet({ type, color });
      provider.reveal();
    }),

    vscode.commands.registerCommand("codeCritters.removeOne", async () => {
      const pets = provider.getPets();
      if (pets.length === 0) {
        vscode.window.showInformationMessage("No critters to remove.");
        return;
      }
      const pick = await vscode.window.showQuickPick(
        pets.map((p, i) => ({
          label: p.name ? `${p.name} the ${p.type}` : p.type,
          description:
            p.color && p.color !== "custom" ? p.color : undefined,
          index: i,
        })),
        { placeHolder: "Remove which critter?" }
      );
      if (pick) {
        provider.removePet(pick.index);
      }
    }),

    vscode.commands.registerCommand("codeCritters.rename", async () => {
      const pets = provider.getPets();
      if (pets.length === 0) {
        vscode.window.showInformationMessage("No critters to rename.");
        return;
      }
      const pick = await vscode.window.showQuickPick(
        pets.map((p, i) => ({
          label: p.name ? `${p.name} the ${p.type}` : p.type,
          description:
            p.color && p.color !== "custom" ? p.color : undefined,
          index: i,
        })),
        { placeHolder: "Rename which critter?" }
      );
      if (pick) {
        await promptRename(pick.index);
      }
    }),

    vscode.commands.registerCommand("codeCritters.clear", () => {
      provider.clearPets();
    }),

    vscode.commands.registerCommand("codeCritters.throwTreat", () => {
      provider.throwTreat();
      provider.reveal();
    }),

    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("codeCritters")) {
        provider.refresh();
      }
    })
  );

  let diagTimer: ReturnType<typeof setTimeout> | undefined;
  let lastErrors = -1;
  let lastWarnings = -1;
  context.subscriptions.push(
    vscode.languages.onDidChangeDiagnostics(() => {
      if (diagTimer) {
        clearTimeout(diagTimer);
      }
      diagTimer = setTimeout(() => {
        const cfg = vscode.workspace.getConfiguration("codeCritters");
        if (!cfg.get<boolean>("reactToErrors", true)) {
          return;
        }
        const { errors, warnings } = countDiagnostics();
        if (errors !== lastErrors || warnings !== lastWarnings) {
          lastErrors = errors;
          lastWarnings = warnings;
          provider.reportDiagnostics(errors, warnings);
        }
      }, 600);
    }),

    vscode.workspace.onDidSaveTextDocument(() => {
      const cfg = vscode.workspace.getConfiguration("codeCritters");
      if (!cfg.get<boolean>("reactToErrors", true)) {
        return;
      }
      if (countDiagnostics().errors === 0) {
        provider.notifyCleanSave();
      }
    })
  );
}

function countDiagnostics(): { errors: number; warnings: number } {
  let errors = 0;
  let warnings = 0;
  for (const [, diags] of vscode.languages.getDiagnostics()) {
    for (const d of diags) {
      if (d.severity === vscode.DiagnosticSeverity.Error) {
        errors++;
      } else if (d.severity === vscode.DiagnosticSeverity.Warning) {
        warnings++;
      }
    }
  }
  return { errors, warnings };
}

export function deactivate() {}

export type { PetSpec };

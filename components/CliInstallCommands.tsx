import { Command } from "@/components/Copy";

export function CliInstallCommands() {
  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-faint">
          macOS / Linux
        </p>
        <Command>curl -fsSL https://api.smolclouds.com/install.sh | sh</Command>
      </div>
      <div>
        <p className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-faint">
          Windows PowerShell
        </p>
        <Command prompt="PS&gt;">irm https://api.smolclouds.com/install.ps1 | iex</Command>
      </div>
    </div>
  );
}

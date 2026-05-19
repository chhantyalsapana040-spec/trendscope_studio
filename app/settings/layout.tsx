import { WorkspaceShell } from "@/components/layout/workspace-shell";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}

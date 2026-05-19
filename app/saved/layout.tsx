import { WorkspaceShell } from "@/components/layout/workspace-shell";

export default function SavedLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}

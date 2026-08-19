"use client";

import { PunchPatch, type PunchPatchPermission, type PunchPatchRole } from "./component";

const ROLES: PunchPatchRole[] = [
  { id: "editors", name: "Editors" },
  { id: "reviewers", name: "Reviewers" },
  { id: "viewers", name: "Viewers" },
];

// "delete" depends on "edit" — granting it cascades a grant of edit first,
// riding one shared punch bar rather than two separate animations.
const PERMISSIONS: PunchPatchPermission[] = [
  { id: "read", name: "Read projects" },
  { id: "edit", name: "Edit projects" },
  { id: "delete", name: "Delete projects", requires: "edit" },
  { id: "manage", name: "Manage members" },
];

export default function PunchPatchDemo() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-3xl">
        <p className="mb-4 font-mono text-xs tracking-widest text-ns-muted">
          ns-ui / punch-patch
        </p>
        <PunchPatch
          label="Project access"
          roles={ROLES}
          permissions={PERMISSIONS}
          defaultGranted={[
            { roleId: "editors", permissionId: "read" },
            { roleId: "editors", permissionId: "edit" },
          ]}
          defaultRevoked={[{ roleId: "reviewers", permissionId: "manage" }]}
          inherited={[{ roleId: "reviewers", permissionId: "read", from: "Viewer" }]}
        />
        <p className="mt-3 font-mono text-[11px] text-ns-muted">
          grant punches a hole; revoke patches over it and the patch never comes off —
          re-granting punches straight through, torn corners and all.
        </p>
      </div>
    </main>
  );
}

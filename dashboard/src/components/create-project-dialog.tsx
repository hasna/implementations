import * as React from "react";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface CreateProjectDialogProps {
  onCreate: (data: { name: string; path: string; description?: string }) => Promise<boolean>;
}

export function CreateProjectDialog({ onCreate }: CreateProjectDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [path, setPath] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !path.trim() || submitting) return;
    setSubmitting(true);
    let ok = false;
    try {
      ok = await onCreate({
        name: name.trim(),
        path: path.trim(),
        description: description.trim() || undefined,
      });
    } catch {
      ok = false;
    } finally {
      setSubmitting(false);
    }
    if (ok) {
      setName("");
      setPath("");
      setDescription("");
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon className="size-3.5" />
          New Project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Register Project</DialogTitle>
            <DialogDescription>
              Register a repository as a project to track its plans, audits, and
              logs.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="project-name" className="text-sm font-medium">
                Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-project"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="project-path" className="text-sm font-medium">
                Path <span className="text-destructive">*</span>
              </label>
              <Input
                id="project-path"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                placeholder="/Users/you/repos/my-project"
              />
            </div>
            <div className="grid gap-2">
              <label
                htmlFor="project-description"
                className="text-sm font-medium"
              >
                Description
              </label>
              <Input
                id="project-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!name.trim() || !path.trim() || submitting}>
              Register Project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

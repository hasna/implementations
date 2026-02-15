import * as React from "react";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CreateLogDialogProps {
  onCreate: (data: {
    message: string;
    level?: string;
    source?: string;
  }) => void;
}

export function CreateLogDialog({ onCreate }: CreateLogDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [level, setLevel] = React.useState("info");
  const [source, setSource] = React.useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;

    onCreate({
      message: message.trim(),
      level,
      source: source.trim() || undefined,
    });

    setMessage("");
    setLevel("info");
    setSource("");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon className="size-3.5" />
          New Log
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Log Entry</DialogTitle>
            <DialogDescription>Add a new log entry.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Message *</label>
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Log message"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Level</label>
                <Select value={level} onValueChange={setLevel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debug">Debug</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warn">Warn</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Source</label>
                <Input
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="e.g. cli, api"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!message.trim()}>
              Create Log
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

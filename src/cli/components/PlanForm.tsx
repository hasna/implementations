import { useState } from "react";
import { Box, Text, useInput } from "ink";

interface PlanFormProps {
  onSubmit: (data: { title: string; description?: string; status?: string }) => void;
  onCancel: () => void;
}

type Field = "title" | "description" | "status";

const STATUSES = ["draft", "review", "approved", "in_progress", "done", "archived"];

export function PlanForm({ onSubmit, onCancel }: PlanFormProps) {
  const [field, setField] = useState<Field>("title");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [statusIdx, setStatusIdx] = useState(0);

  useInput((input, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (field === "status") {
      if (key.leftArrow || input === "h") {
        setStatusIdx((i) => Math.max(0, i - 1));
      } else if (key.rightArrow || input === "l") {
        setStatusIdx((i) => Math.min(STATUSES.length - 1, i + 1));
      } else if (key.return) {
        onSubmit({
          title,
          description: description || undefined,
          status: STATUSES[statusIdx],
        });
      } else if (key.tab) {
        setField("title");
      }
      return;
    }

    const [value, setter] =
      field === "title" ? [title, setTitle] : [description, setDescription];

    if (key.return) {
      if (field === "title") {
        setField("description");
      } else {
        setField("status");
      }
    } else if (key.backspace || key.delete) {
      setter(value.slice(0, -1));
    } else if (key.tab) {
      if (field === "title") setField("description");
      else setField("status");
    } else if (input && !key.ctrl && !key.meta) {
      setter(value + input);
    }
  });

  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Text bold>Add Plan</Text>
      <Text dimColor>[tab] next field  [enter] confirm  [esc] cancel</Text>
      <Box marginTop={1}>
        <Text dimColor>Title:  </Text>
        <Text color={field === "title" ? "cyan" : undefined}>
          {title}
          {field === "title" ? "▌" : ""}
        </Text>
      </Box>
      <Box>
        <Text dimColor>Desc:   </Text>
        <Text color={field === "description" ? "cyan" : undefined}>
          {description}
          {field === "description" ? "▌" : ""}
        </Text>
      </Box>
      <Box>
        <Text dimColor>Status: </Text>
        {STATUSES.map((s, i) => (
          <Text
            key={s}
            color={i === statusIdx && field === "status" ? "cyan" : undefined}
            bold={i === statusIdx}
          >
            {i === statusIdx ? `[${s}]` : ` ${s} `}
            {" "}
          </Text>
        ))}
      </Box>
    </Box>
  );
}

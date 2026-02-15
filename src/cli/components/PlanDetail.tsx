import { Box, Text } from "ink";
import type { Plan } from "../../types/index.js";

interface PlanDetailProps {
  plan: Plan;
}

const statusColors: Record<string, string> = {
  draft: "gray",
  review: "yellow",
  approved: "cyan",
  in_progress: "blue",
  done: "green",
  archived: "gray",
};

export function PlanDetail({ plan }: PlanDetailProps) {
  const sColor = statusColors[plan.status] || "white";

  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Box marginBottom={1}>
        <Text dimColor>[esc] back</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Text dimColor>{"ID:          "}</Text>
          <Text>{plan.id}</Text>
        </Box>
        <Box>
          <Text dimColor>{"Title:       "}</Text>
          <Text bold>{plan.title}</Text>
        </Box>
        <Box>
          <Text dimColor>{"Slug:        "}</Text>
          <Text>{plan.slug}</Text>
        </Box>
        <Box>
          <Text dimColor>{"Status:      "}</Text>
          <Text color={sColor}>{plan.status}</Text>
        </Box>
        {plan.description && (
          <Box>
            <Text dimColor>{"Description: "}</Text>
            <Text>{plan.description}</Text>
          </Box>
        )}
        {plan.tags.length > 0 && (
          <Box>
            <Text dimColor>{"Tags:        "}</Text>
            <Text>{plan.tags.join(", ")}</Text>
          </Box>
        )}
        <Box>
          <Text dimColor>{"Version:     "}</Text>
          <Text>{plan.version}</Text>
        </Box>
        <Box>
          <Text dimColor>{"Created:     "}</Text>
          <Text>{plan.created_at}</Text>
        </Box>
        <Box>
          <Text dimColor>{"Updated:     "}</Text>
          <Text>{plan.updated_at}</Text>
        </Box>
      </Box>

      {plan.content && (
        <Box flexDirection="column">
          <Text bold>Content:</Text>
          <Text>{plan.content}</Text>
        </Box>
      )}
    </Box>
  );
}

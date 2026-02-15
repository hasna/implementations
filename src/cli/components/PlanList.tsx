import { Box, Text } from "ink";
import type { Plan } from "../../types/index.js";

interface PlanListProps {
  plans: Plan[];
  selectedIndex: number;
}

const statusColors: Record<string, string> = {
  draft: "gray",
  review: "yellow",
  approved: "cyan",
  in_progress: "blue",
  done: "green",
  archived: "gray",
};

export function PlanList({ plans, selectedIndex }: PlanListProps) {
  if (plans.length === 0) {
    return (
      <Box marginLeft={2}>
        <Text dimColor>No plans found.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {plans.map((plan, index) => {
        const isSelected = index === selectedIndex;
        const color = statusColors[plan.status] || "white";
        const tags = plan.tags.length > 0 ? ` [${plan.tags.join(",")}]` : "";

        return (
          <Box key={plan.id}>
            <Text color={isSelected ? "cyan" : undefined} bold={isSelected}>
              {isSelected ? "❯ " : "  "}
            </Text>
            <Text color={color}>{plan.status.padEnd(11)} </Text>
            <Text dimColor>{plan.id.slice(0, 8)} </Text>
            <Text bold={isSelected}>{plan.title}</Text>
            {tags && <Text dimColor>{tags}</Text>}
          </Box>
        );
      })}
    </Box>
  );
}

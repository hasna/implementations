import { Box, Text } from "ink";
import type { Audit } from "../../types/index.js";

interface AuditListProps {
  audits: Audit[];
  selectedIndex: number;
}

const statusColors: Record<string, string> = {
  pending: "yellow",
  in_progress: "blue",
  completed: "green",
  failed: "red",
};

const severityColors: Record<string, string> = {
  info: "gray",
  low: "cyan",
  medium: "yellow",
  high: "red",
  critical: "red",
};

export function AuditList({ audits, selectedIndex }: AuditListProps) {
  if (audits.length === 0) {
    return (
      <Box marginLeft={2}>
        <Text dimColor>No audits found.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {audits.map((audit, index) => {
        const isSelected = index === selectedIndex;
        const color = statusColors[audit.status] || "white";
        const sevColor = audit.severity ? (severityColors[audit.severity] || "white") : "gray";

        return (
          <Box key={audit.id}>
            <Text color={isSelected ? "cyan" : undefined} bold={isSelected}>
              {isSelected ? "❯ " : "  "}
            </Text>
            <Text color={color}>{audit.status.padEnd(11)} </Text>
            <Text>{audit.type.padEnd(12)} </Text>
            <Text color={sevColor}>{(audit.severity || "-").padEnd(8)} </Text>
            <Text dimColor>{audit.id.slice(0, 8)} </Text>
            <Text bold={isSelected}>{audit.title}</Text>
          </Box>
        );
      })}
    </Box>
  );
}

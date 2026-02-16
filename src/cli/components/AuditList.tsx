import { Box, Text } from "ink";
import type { Audit } from "../../types/index.js";
import { safeText } from "../utils/terminal.js";

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
        const severityLabel = safeText(audit.severity || "-").padEnd(8);
        const typeLabel = safeText(audit.type).padEnd(12);

        return (
          <Box key={audit.id}>
            <Text color={isSelected ? "cyan" : undefined} bold={isSelected}>
              {isSelected ? "❯ " : "  "}
            </Text>
            <Text color={color}>{safeText(audit.status).padEnd(11)} </Text>
            <Text>{typeLabel} </Text>
            <Text color={sevColor}>{severityLabel} </Text>
            <Text dimColor>{safeText(audit.id.slice(0, 8))} </Text>
            <Text bold={isSelected}>{safeText(audit.title)}</Text>
          </Box>
        );
      })}
    </Box>
  );
}

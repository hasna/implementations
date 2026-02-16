import { Box, Text } from "ink";
import type { Audit } from "../../types/index.js";
import { safeText } from "../utils/terminal.js";

interface AuditDetailProps {
  audit: Audit;
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

export function AuditDetail({ audit }: AuditDetailProps) {
  const sColor = statusColors[audit.status] || "white";
  const sevColor = audit.severity ? (severityColors[audit.severity] || "white") : "gray";

  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Box marginBottom={1}>
        <Text dimColor>[esc] back</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Text dimColor>{"ID:        "}</Text>
          <Text>{safeText(audit.id)}</Text>
        </Box>
        <Box>
          <Text dimColor>{"Title:     "}</Text>
          <Text bold>{safeText(audit.title)}</Text>
        </Box>
        <Box>
          <Text dimColor>{"Type:      "}</Text>
          <Text>{safeText(audit.type)}</Text>
        </Box>
        <Box>
          <Text dimColor>{"Status:    "}</Text>
          <Text color={sColor}>{safeText(audit.status)}</Text>
        </Box>
        {audit.severity && (
          <Box>
            <Text dimColor>{"Severity:  "}</Text>
            <Text color={sevColor}>{safeText(audit.severity)}</Text>
          </Box>
        )}
        <Box>
          <Text dimColor>{"Version:   "}</Text>
          <Text>{safeText(audit.version)}</Text>
        </Box>
        <Box>
          <Text dimColor>{"Created:   "}</Text>
          <Text>{safeText(audit.created_at)}</Text>
        </Box>
        <Box>
          <Text dimColor>{"Updated:   "}</Text>
          <Text>{safeText(audit.updated_at)}</Text>
        </Box>
        {audit.completed_at && (
          <Box>
            <Text dimColor>{"Completed: "}</Text>
            <Text>{safeText(audit.completed_at)}</Text>
          </Box>
        )}
      </Box>

      {audit.findings && (
        <Box flexDirection="column">
          <Text bold>Findings:</Text>
          <Text>{safeText(audit.findings)}</Text>
        </Box>
      )}
    </Box>
  );
}

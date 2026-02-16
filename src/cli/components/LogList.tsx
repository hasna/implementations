import { Box, Text } from "ink";
import type { Log } from "../../types/index.js";
import { safeText } from "../utils/terminal.js";

interface LogListProps {
  logs: Log[];
  selectedIndex: number;
}

const levelColors: Record<string, string> = {
  debug: "gray",
  info: "cyan",
  warn: "yellow",
  error: "red",
};

export function LogList({ logs, selectedIndex }: LogListProps) {
  if (logs.length === 0) {
    return (
      <Box marginLeft={2}>
        <Text dimColor>No logs found.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column">
      {logs.map((log, index) => {
        const isSelected = index === selectedIndex;
        const color = levelColors[log.level] || "white";
        const ts = log.created_at.replace("T", " ").slice(0, 19);
        const levelLabel = safeText(log.level).toUpperCase().padEnd(5);

        return (
          <Box key={log.id}>
            <Text color={isSelected ? "cyan" : undefined} bold={isSelected}>
              {isSelected ? "❯ " : "  "}
            </Text>
            <Text color={color}>[{levelLabel}] </Text>
            <Text dimColor>{safeText(ts)} </Text>
            <Text dimColor>{safeText(log.source).padEnd(10)} </Text>
            <Text bold={isSelected}>{safeText(log.message)}</Text>
          </Box>
        );
      })}
    </Box>
  );
}

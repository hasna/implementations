import { useState } from "react";
import { Box, Text, useInput } from "ink";
import type { Plan, Audit } from "../../types/index.js";

interface SearchViewProps {
  planResults: Plan[];
  auditResults: Audit[];
  onSearch: (query: string) => void;
  onBack: () => void;
}

const planStatusColors: Record<string, string> = {
  draft: "gray",
  review: "yellow",
  approved: "cyan",
  in_progress: "blue",
  done: "green",
  archived: "gray",
};

const auditStatusColors: Record<string, string> = {
  pending: "yellow",
  in_progress: "blue",
  completed: "green",
  failed: "red",
};

export function SearchView({ planResults, auditResults, onSearch, onBack }: SearchViewProps) {
  const [query, setQuery] = useState("");
  const [isTyping, setIsTyping] = useState(true);

  useInput((input, key) => {
    if (key.escape) {
      if (!isTyping) {
        setIsTyping(true);
      } else {
        onBack();
      }
      return;
    }

    if (isTyping) {
      if (key.return) {
        onSearch(query);
        setIsTyping(false);
      } else if (key.backspace || key.delete) {
        setQuery((q) => q.slice(0, -1));
      } else if (input && !key.ctrl && !key.meta) {
        setQuery((q) => q + input);
      }
    } else {
      if (input === "/") {
        setIsTyping(true);
      }
    }
  });

  const total = planResults.length + auditResults.length;

  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Box marginBottom={1}>
        <Text dimColor>[esc] back  [enter] search  [/] new search</Text>
      </Box>

      <Box>
        <Text dimColor>Search: </Text>
        <Text color={isTyping ? "cyan" : undefined}>
          {query}
          {isTyping ? "▌" : ""}
        </Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {total === 0 && !isTyping && (
          <Text dimColor>No results found.</Text>
        )}

        {planResults.length > 0 && (
          <Box flexDirection="column">
            <Text bold>Plans ({planResults.length}):</Text>
            {planResults.map((plan) => (
              <Box key={plan.id} marginLeft={1}>
                <Text color={planStatusColors[plan.status] || "white"}>
                  [{plan.status}]{" "}
                </Text>
                <Text dimColor>{plan.id.slice(0, 8)} </Text>
                <Text>{plan.title}</Text>
              </Box>
            ))}
          </Box>
        )}

        {auditResults.length > 0 && (
          <Box flexDirection="column" marginTop={planResults.length > 0 ? 1 : 0}>
            <Text bold>Audits ({auditResults.length}):</Text>
            {auditResults.map((audit) => (
              <Box key={audit.id} marginLeft={1}>
                <Text color={auditStatusColors[audit.status] || "white"}>
                  [{audit.status}]{" "}
                </Text>
                <Text dimColor>{audit.id.slice(0, 8)} </Text>
                <Text>{audit.type} | {audit.title}</Text>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

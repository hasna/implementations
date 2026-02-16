import { Box, Text } from "ink";
import { safeText } from "../utils/terminal.js";

interface HeaderProps {
  projectName?: string;
  itemCount: number;
  view: string;
}

export function Header({ projectName, itemCount, view }: HeaderProps) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color="cyan">
          {" "}implementations{" "}
        </Text>
        <Text dimColor> | </Text>
        <Text color="white">{safeText(view)}</Text>
        {projectName && (
          <>
            <Text dimColor> | </Text>
            <Text color="yellow">{safeText(projectName)}</Text>
          </>
        )}
        <Text dimColor> | </Text>
        <Text>{itemCount} item(s)</Text>
      </Box>
      <Box>
        <Text dimColor>
          [p] plans [a] audits [l] logs [P] projects [/] search [q] quit
        </Text>
      </Box>
    </Box>
  );
}
